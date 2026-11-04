import type {
  CardRecord,
  PullDelta,
  TopicConflictResolved,
  TopicRecord
} from '@spaced-rep/sync-protocol'
import { hydrateIncomingCardData } from '@/lib/sync-media'
import { shouldApplyRemote, type CardRow } from '@/lib/sync-serialize'
import { STORES } from '@/lib/db'
import type { Card, Topic } from '@/models'
import { sync as syncBackend } from '@/providers'
import { emitStudyData } from './study-memory'
import { addFailedOps, advanceCursor, getCursor } from './sync-meta'
import { getQueue } from './sync-queue'
import { httpSyncMediaApi } from './sync-http.client'
import {
  deleteLocalCard,
  deleteLocalTopic,
  putLocal,
  readDurableRecord,
  readDurableRows
} from './sync-local'
import { recordToCard, recordToTopic } from './sync-records'
import type { FailedOp, SyncTable } from './sync-state'
import { announceStudyDataChange } from './sync-tabs'

/** Failure code for a pulled record this client can never apply. */
const POISON_CODE = 'POISON_RECORD'

type DurableRows = Awaited<ReturnType<typeof readDurableRows>>

interface ApplyContext {
  rows: DurableRows
  hydratedCardData: Map<string, unknown>
  progress: { mutated: boolean }
  poisoned: FailedOp[]
}

/** Deltas apply strictly one after another (HTTP pull, bootstrap, WebSocket fanout). */
let applyChain: Promise<unknown> = Promise.resolve()

export function resetPullStateForTests(): void {
  applyChain = Promise.resolve()
}

function poisonOp(
  table: SyncTable,
  recordId: string,
  error: unknown
): FailedOp {
  return {
    // Stable per record: a record redelivered by later pulls replaces its entry.
    opId: `pull:${table}:${recordId}`,
    table,
    recordId,
    code: POISON_CODE,
    message: error instanceof Error ? error.message : String(error),
    at: Date.now()
  }
}

export async function applyTopicConflict(
  conflict: TopicConflictResolved
): Promise<void> {
  const local = await readDurableRecord<Topic>(STORES.TOPICS, conflict.topicId)
  if (!local) return
  local.title = conflict.newTitle
  local.updatedAt = conflict.updatedAt
  await putLocal(STORES.TOPICS, local)
  emitStudyData()

  if (
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('SYNC_DEBUG')
  ) {
    console.info('Topic renamed to avoid duplicate:', conflict)
  }
}

/**
 * Shared incoming pipeline for HTTP pull, bootstrap/reconcile, and WS onDelta.
 * Serialized: two deltas interleaving would race on local reads and the cursor.
 */
export function applyPullDelta(delta: PullDelta): Promise<void> {
  const run = applyChain.then(() => applyPullDeltaNow(delta))
  // A failed delta must not wedge the ones queued behind it.
  applyChain = run.catch(() => undefined)
  return run
}

async function applyPullDeltaNow(delta: PullDelta): Promise<void> {
  const progress = { mutated: false }
  try {
    await applyPullDeltaRecords(delta, progress)
  } finally {
    // One notification per batch, also when a later record fails after earlier
    // ones were already committed.
    if (progress.mutated) {
      emitStudyData()
      announceStudyDataChange()
    }
  }
}

async function applyPullDeltaRecords(
  delta: PullDelta,
  progress: { mutated: boolean }
): Promise<void> {
  // Hydrate + verify all owned media before any local write or watermark bump.
  const hydratedCardData = await hydrateIncomingCardData(
    delta,
    httpSyncMediaApi
  )
  const context: ApplyContext = {
    rows: await readDurableRows(delta),
    hydratedCardData,
    progress,
    poisoned: []
  }

  try {
    for (const record of delta.records) {
      if (record.topic) await applyTopicRecord(record.topic, context)
      if (record.card) await applyCardRecord(record.card, context)
    }
  } finally {
    await addFailedOps(context.poisoned)
  }

  // Fanout deltas carry an empty cursor: they cover one push, not a range.
  if (delta.watermark) await advanceCursor(delta.watermark)
}

async function applyTopicRecord(
  remote: TopicRecord,
  { rows, progress, poisoned }: ApplyContext
): Promise<void> {
  const local = rows.topics.get(remote.id)

  if (remote.deletedAt) {
    // Tombstone is LWW too: a newer local edit survives an older delete.
    if (local && shouldApplyRemote(local.updatedAt, remote.updatedAt)) {
      await deleteLocalTopic(remote.id)
      rows.topics.delete(remote.id)
      progress.mutated = true
    }
    return
  }

  if (!shouldApplyRemote(local?.updatedAt, remote.updatedAt)) return

  let incoming: Topic
  try {
    incoming = recordToTopic(remote)
  } catch (error) {
    poisoned.push(poisonOp(STORES.TOPICS, remote.id, error))
    return
  }

  try {
    await putLocal(STORES.TOPICS, incoming)
  } catch (err) {
    if ((err as Error).name !== 'ConstraintError') throw err
    // Local title unique constraint: rename the incoming topic.
    incoming.title = `${incoming.title} (${incoming.id.slice(0, 4)})`
    await putLocal(STORES.TOPICS, incoming)
  }
  rows.topics.set(remote.id, incoming)
  progress.mutated = true
}

async function applyCardRecord(
  remote: CardRecord,
  { rows, hydratedCardData, progress, poisoned }: ApplyContext
): Promise<void> {
  const local = rows.cards.get(remote.id)

  if (remote.deletedAt) {
    if (local && shouldApplyRemote(local.updatedAt, remote.updatedAt)) {
      await deleteLocalCard(remote.id)
      rows.cards.delete(remote.id)
      progress.mutated = true
    }
    return
  }

  if (!shouldApplyRemote(local?.updatedAt, remote.updatedAt)) return

  const data = hydratedCardData.get(remote.id)
  if (data === undefined) {
    poisoned.push(
      poisonOp(STORES.CARDS, remote.id, new Error('Card data is unreadable'))
    )
    return
  }

  let incoming: Card
  try {
    incoming = recordToCard(remote, data as CardRow['data'])
  } catch (error) {
    poisoned.push(poisonOp(STORES.CARDS, remote.id, error))
    return
  }

  await putLocal(STORES.CARDS, incoming)
  rows.cards.set(remote.id, incoming)
  progress.mutated = true
}

export async function pullChanges(deviceId: string): Promise<void> {
  if (!syncBackend) return
  let since = await getCursor()
  for (;;) {
    const delta = await syncBackend.pull({ deviceId, since })
    await applyPullDelta(delta)
    if (!delta.more) return
    since = delta.watermark || (await getCursor())
  }
}

/** Bootstrap from `lastPulledAt`, then page through the rest of the backlog. */
export async function bootstrapPull(
  deviceId: string,
  lastPulledAt: string
): Promise<void> {
  if (!syncBackend) return
  const delta = await syncBackend.bootstrap({
    deviceId,
    lastPulledAt,
    pendingOpCount: (await getQueue()).length
  })
  await applyPullDelta(delta)
  if (delta.more) await pullChanges(deviceId)
}
