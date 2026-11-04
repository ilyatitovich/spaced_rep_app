import type {
  MediaDBRecord,
  Mutation,
  PushAck
} from '@spaced-rep/sync-protocol'
import { ApiError } from '@/lib/api'
import { STORES } from '@/lib/db'
import { mergePreparedMedia, uploadOwnedMedia } from '@/lib/sync-media'
import type { Card, Topic } from '@/models'
import { sync as syncBackend } from '@/providers'
import type { SyncRealtimeHandle } from '@/providers/types'
import { httpSyncMediaApi } from './sync-http.client'
import { readDurableRecord } from './sync-local'
import { addFailedOps, getDeviceId } from './sync-meta'
import {
  bumpQueueAttempts,
  getQueue,
  inFlightOpIds,
  removeQueueItem,
  removeQueueItemIfOp,
  type QueueItem
} from './sync-queue'
import { applyTopicConflict } from './sync-pull'
import { cardToWireRecord, topicToRecord } from './sync-records'
import { setState, type FailedOp } from './sync-state'

const MAX_PUSH_BATCH = 50
/** Server HTTP/WS payload limit is 1mb; leave headroom for the envelope wrapper. */
const MAX_PUSH_BYTES = 700_000
const MAX_ATTEMPTS = 10
const INITIAL_RATE_LIMIT_DELAY_MS = 2_000
const MAX_RATE_LIMIT_DELAY_MS = 60_000

interface MutationBatch {
  mutations: Mutation[]
  items: QueueItem[]
  mediaByHash: Map<string, MediaDBRecord>
}

// oxlint-disable-next-line sonarjs/cognitive-complexity
async function buildMutations(items: QueueItem[]): Promise<MutationBatch> {
  const deviceId = await getDeviceId()
  const mutations: Mutation[] = []
  const included: QueueItem[] = []
  const mediaByHash = new Map<string, MediaDBRecord>()
  // ponytail: count+byte caps; blob store later if single cards exceed 1mb
  let approxBytes = 256

  const tryAdd = (item: QueueItem, mutation: Mutation): boolean => {
    const addBytes = JSON.stringify(mutation).length + 1
    if (mutations.length > 0 && approxBytes + addBytes > MAX_PUSH_BYTES) {
      return false
    }
    mutations.push(mutation)
    included.push(item)
    approxBytes += addBytes
    return true
  }

  for (const item of items) {
    if (item.nextRetryAt > Date.now()) continue
    if (mutations.length >= MAX_PUSH_BATCH) break

    const base = {
      opId: item.opId || crypto.randomUUID(),
      deviceId,
      table: item.table,
      recordId: item.recordId,
      operation: item.operation,
      updatedAt: Date.now()
    }

    if (item.operation === 'delete') {
      // LWW needs when the delete happened, not when it was flushed: an offline
      // delete must not beat edits other devices made after it.
      if (!tryAdd(item, { ...base, updatedAt: item.createdAt })) break
      continue
    }

    // Read the durable row: another tab may have written it after this tab's
    // memory was loaded, and the op must carry what is actually stored.
    if (item.table === STORES.TOPICS) {
      const topic = await readDurableRecord<Topic>(STORES.TOPICS, item.recordId)
      if (!topic) {
        await removeQueueItem(item.id)
        continue
      }
      if (
        !tryAdd(item, {
          ...base,
          updatedAt: topic.updatedAt ?? Date.now(),
          topic: topicToRecord(topic)
        })
      ) {
        break
      }
    } else {
      const card = await readDurableRecord<Card>(STORES.CARDS, item.recordId)
      if (!card) {
        await removeQueueItem(item.id)
        continue
      }
      const { record, mediaByHash: cardMedia } = await cardToWireRecord(card)
      if (
        !tryAdd(item, {
          ...base,
          updatedAt: card.updatedAt ?? Date.now(),
          card: record
        })
      ) {
        break
      }
      mergePreparedMedia(mediaByHash, cardMedia)
    }
  }

  return { mutations, items: included, mediaByHash }
}

async function applyPushAck(ack: PushAck, items: QueueItem[]): Promise<void> {
  const byOpId = new Map(items.map(i => [i.opId, i]))

  for (const opId of ack.acceptedOpIds) {
    const item = byOpId.get(opId)
    if (item) await removeQueueItemIfOp(item)
  }

  for (const conflict of ack.conflicts) {
    await applyTopicConflict(conflict)
    const item = [...byOpId.values()].find(i => i.recordId === conflict.topicId)
    if (item) await removeQueueItemIfOp(item)
  }

  const failed: FailedOp[] = []
  for (const rejected of ack.rejected) {
    const item = byOpId.get(rejected.opId)
    if (!item) continue

    if (!rejected.retryable || item.attempts + 1 >= MAX_ATTEMPTS) {
      failed.push({
        opId: rejected.opId,
        table: item.table,
        recordId: item.recordId,
        code: rejected.code,
        message: rejected.message,
        at: Date.now()
      })
      await removeQueueItemIfOp(item)
    } else {
      await bumpQueueAttempts(item)
    }
  }
  await addFailedOps(failed)
  setState({ queueDepth: (await getQueue()).length })
}

async function sendBatch(
  deviceId: string,
  mutations: Mutation[],
  realtime: SyncRealtimeHandle | null
): Promise<PushAck> {
  if (!syncBackend) throw new Error('Sync backend is not configured')

  if (realtime?.isActive() && realtime.pushBatch) {
    try {
      const ack = await realtime.pushBatch(mutations)
      setState({ connection: 'ws' })
      return ack
    } catch {
      // Fall back to HTTP below; the server dedupes by opId.
    }
  }
  const ack = await syncBackend.push({ deviceId, mutations })
  setState({ connection: 'http' })
  return ack
}

function isRateLimited(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.code === 'RATE_LIMITED' || err.status === 429)
  )
}

/** Uploads media, sends one batch and applies the ack. Returns max accepted updatedAt. */
async function pushBatchOnce(
  deviceId: string,
  realtime: SyncRealtimeHandle | null,
  { mutations, items, mediaByHash }: MutationBatch
): Promise<number> {
  // Upload owned buffers before pushBatch so the server can HeadObject refs.
  await uploadOwnedMedia(mediaByHash, httpSyncMediaApi)

  const ack = await sendBatch(deviceId, mutations, realtime)
  const accepted = new Set(ack.acceptedOpIds)
  const maxAcceptedUpdatedAt = Math.max(
    0,
    ...mutations.filter(m => accepted.has(m.opId)).map(m => m.updatedAt)
  )

  await applyPushAck(ack, items)
  return maxAcceptedUpdatedAt
}

/**
 * Drains the outbox in batches. Returns max updatedAt among accepted
 * mutations. Rate limits back off and retry the same batch; other errors throw.
 */
export async function pushQueue(
  deviceId: string,
  realtime: SyncRealtimeHandle | null
): Promise<number> {
  if (!syncBackend) return 0

  let rateLimitDelayMs = INITIAL_RATE_LIMIT_DELAY_MS
  let maxAcceptedUpdatedAt = 0

  // Drain in batches — one MAX_PUSH_BATCH push leaves the rest stranded.
  while (true) {
    const queue = await getQueue()
    if (queue.length === 0) return maxAcceptedUpdatedAt

    const batch = await buildMutations(queue)
    if (batch.mutations.length === 0) return maxAcceptedUpdatedAt

    for (const item of batch.items) inFlightOpIds.add(item.opId)
    try {
      const accepted = await pushBatchOnce(deviceId, realtime, batch)
      maxAcceptedUpdatedAt = Math.max(maxAcceptedUpdatedAt, accepted)
      rateLimitDelayMs = INITIAL_RATE_LIMIT_DELAY_MS
    } catch (err) {
      if (!isRateLimited(err)) throw err

      await new Promise<void>(resolve => setTimeout(resolve, rateLimitDelayMs))
      rateLimitDelayMs = Math.min(MAX_RATE_LIMIT_DELAY_MS, rateLimitDelayMs * 2)
    } finally {
      for (const item of batch.items) inFlightOpIds.delete(item.opId)
    }
  }
}
