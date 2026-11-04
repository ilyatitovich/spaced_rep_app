import {
  INITIAL_CURSOR,
  isCursorAhead,
  type Mutation,
  type PullDelta,
  type PushAck,
  type TopicConflictResolved,
  type TopicRecord,
  type CardRecord
} from '@spaced-rep/sync-protocol'
import { STORES, withTransaction } from '@/lib/db'
import {
  adjustCardMediaStats,
  addEmbeddedMedia,
  recordCardMediaDelete,
  recordCardMediaUpsert,
  sumEmbeddedCardMedia,
  subEmbeddedMedia,
  type EmbeddedCardMedia
} from '@/lib/card-media-stats'
import {
  rowToCard,
  rowToTopic,
  shouldApplyRemote,
  type CardRow
} from '@/lib/sync-serialize'
import {
  hydrateIncomingCardData,
  mergePreparedMedia,
  prepareWireCardData,
  uploadOwnedMedia
} from '@/lib/sync-media'
import { Card, Topic } from '@/models'
import { isBackendConfigured, sync as syncBackend } from '@/providers'
import type { SyncRealtimeHandle } from '@/providers/types'
import { ApiError } from '@/lib/api'
import type { MediaDBRecord } from '@spaced-rep/sync-protocol'
import type { WsConnectionState } from './sync-ws.manager'
import { httpSyncMediaApi } from './sync-http.client'
import {
  clearStudyMemory,
  deleteCardFromMemory,
  deleteTopicFromMemory,
  emitStudyData,
  getAllCardsFromMemory,
  getAllTopicsFromMemory,
  getCardFromMemory,
  getCardsByTopicFromMemory,
  getTopicFromMemory,
  putCardInMemory,
  putTopicInMemory,
  restoreCardInMemory,
  restoreTopicInMemory,
  subscribeStudyData
} from './study-memory'

type SyncTable = typeof STORES.TOPICS | typeof STORES.CARDS
type SyncOperation = 'upsert' | 'delete'

/** In-flight push opIds — collapsing those upserts would lose the follow-up delete. */
const inFlightOpIds = new Set<string>()

/** Net-zero: unsynced upsert + delete cancel. Keep the delete if that upsert may still land. */
export function coalesceQueuedOperation(
  existing: SyncOperation | undefined,
  incoming: SyncOperation,
  isExistingInFlight = false
): SyncOperation | null {
  if (existing === 'upsert' && incoming === 'delete' && !isExistingInFlight) {
    return null
  }
  return incoming
}

interface QueueItem {
  id: string
  opId: string
  table: SyncTable
  recordId: string
  operation: SyncOperation
  createdAt: number
  attempts: number
  nextRetryAt: number
}

interface FailedOp {
  opId: string
  table: SyncTable
  recordId: string
  code: string
  message: string
  at: number
}

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'error'
  | 'offline'
  | 'paused'
  | 'revoked'
  | 'update_required'

export type SyncConnection = 'idle' | 'ws' | 'http' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSyncedAt: number | null
  connection: SyncConnection
  queueDepth: number
  deviceId: string | null
  lastError: string | null
  failedOps: FailedOp[]
}

const TRIGGER_DEBOUNCE_MS = 1500
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const DEVICE_ID_KEY = 'deviceId'
const LAST_SYNC_AT_KEY = 'lastSyncAt'
const FAILED_OPS_KEY = 'failedOps'
const MAX_PUSH_BATCH = 50
/** Server HTTP/WS payload limit is 1mb; leave headroom for the envelope wrapper. */
const MAX_PUSH_BYTES = 700_000
const MAX_ATTEMPTS = 10
/** How long sign-out waits to push the outbox before asking the user. */
const SIGN_OUT_FLUSH_TIMEOUT_MS = 10_000
/** How long the wipe waits for the old account's run before wiping anyway. */
const WIPE_WAIT_RUN_MS = 10_000

let currentUserId: string | null = null
let syncEntitled = false
let state: SyncState = {
  status: 'idle',
  lastSyncedAt: null,
  connection: 'idle',
  queueDepth: 0,
  deviceId: null,
  lastError: null,
  failedOps: []
}
let triggerTimer: ReturnType<typeof setTimeout> | null = null
let syncMutex: Promise<void> | null = null
/** A syncAll was requested while one was running — run another pass after it. */
let pendingSyncAll = false
/** In-flight sign-out wipe; initialSync waits on it so a fast re-login can't race it. */
let pendingClear: Promise<void> | null = null
let realtime: SyncRealtimeHandle | null = null

const listeners = new Set<(state: SyncState) => void>()

function withSyncMutex(fn: () => Promise<void>): Promise<void> {
  if (syncMutex) return syncMutex
  syncMutex = fn().finally(() => {
    syncMutex = null
  })
  return syncMutex
}

/** Resolves when `promise` settles or after `ms`, whichever is first. Never rejects. */
async function settleWithin(
  promise: Promise<unknown>,
  ms: number
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      promise.catch(() => undefined),
      new Promise<void>(resolve => {
        timer = setTimeout(resolve, ms)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

function setState(next: Partial<SyncState>): void {
  state = { ...state, ...next }
  listeners.forEach(listener => listener(state))
}

function pauseSync(message = 'Upgrade to Pro to sync'): void {
  syncEntitled = false
  realtime?.disconnect()
  setState({
    status: 'paused',
    connection: 'idle',
    lastError: message
  })
}

/** Keep Pro entitlement — user can mint a new deviceId via reconnectRevokedDevice. */
function markDeviceRevoked(): void {
  realtime?.disconnect()
  setState({
    status: 'revoked',
    connection: 'idle',
    lastError: 'This device was disconnected from sync'
  })
}

/** Hard protocol cutover — keep local data/outbox; stop sync until the app is updated. */
function markUpdateRequired(): void {
  syncEntitled = false
  realtime?.disconnect()
  setState({
    status: 'update_required',
    connection: 'idle',
    lastError: 'Update the app to continue syncing'
  })
}

function isDeviceRevokedError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'DEVICE_REVOKED'
}

function isProtocolMismatchError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'PROTOCOL_MISMATCH'
}

function isPaidAccessError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'PLAN_REQUIRED' || error.code === 'DEVICE_LIMIT')
  )
}

function handleSyncAccessError(error: unknown): boolean {
  if (isDeviceRevokedError(error)) {
    markDeviceRevoked()
    return true
  }
  if (isProtocolMismatchError(error)) {
    markUpdateRequired()
    return true
  }
  if (isPaidAccessError(error)) {
    pauseSync(error instanceof Error ? error.message : undefined)
    return true
  }
  return false
}

export function subscribeSync(
  listener: (state: SyncState) => void
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSyncState(): SyncState {
  return state
}

export function subscribeSyncData(listener: () => void): () => void {
  return subscribeStudyData(listener)
}

function emitSyncData(): void {
  emitStudyData()
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getLocalRecord<T>(
  table: SyncTable,
  id: string
): Promise<T | undefined> {
  if (table === STORES.TOPICS) {
    return getTopicFromMemory(id) as T | undefined
  }
  return getCardFromMemory(id) as T | undefined
}

async function getAllLocal<T>(
  table: SyncTable | typeof STORES.SYNC_QUEUE
): Promise<T[]> {
  if (table === STORES.TOPICS) {
    return getAllTopicsFromMemory() as T[]
  }
  if (table === STORES.CARDS) {
    return getAllCardsFromMemory() as T[]
  }
  return withTransaction(table, 'readonly', stores =>
    promisify<T[]>(stores[table].getAll())
  )
}

// The apply helpers below update memory, then IndexedDB, and roll memory back on
// failure. They do not emit: the caller (applyPullDelta) emits once per batch.
async function putLocal(table: SyncTable, value: Topic | Card): Promise<void> {
  if (table === STORES.CARDS) {
    const card = value as Card
    const previous = putCardInMemory(card)
    try {
      await withTransaction(table, 'readwrite', async stores => {
        await promisify(stores[table].put(card))
      })
    } catch (error) {
      restoreCardInMemory(card.id, previous)
      throw error
    }
    await recordCardMediaUpsert(previous, card)
    return
  }

  const topic = value as Topic
  const previous = putTopicInMemory(topic)
  try {
    await withTransaction(table, 'readwrite', async stores => {
      await promisify(stores[table].put(topic))
    })
  } catch (error) {
    restoreTopicInMemory(topic.id, previous)
    throw error
  }
}

async function deleteLocalTopic(topicId: string): Promise<void> {
  const previousCards = getCardsByTopicFromMemory(topicId)
  const previousTopic = deleteTopicFromMemory(topicId)
  for (const card of previousCards) deleteCardFromMemory(card.id)

  let mediaDelta: EmbeddedCardMedia = {
    bytes: 0,
    images: 0,
    audio: 0
  }
  try {
    await withTransaction(
      [STORES.TOPICS, STORES.CARDS],
      'readwrite',
      async stores => {
        await promisify(stores[STORES.TOPICS].delete(topicId))

        const index = stores[STORES.CARDS].index('topicId')
        const cursorRequest = index.openCursor(IDBKeyRange.only(topicId))

        await new Promise<void>((resolve, reject) => {
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result
            if (cursor) {
              mediaDelta = addEmbeddedMedia(
                mediaDelta,
                subEmbeddedMedia(
                  { bytes: 0, images: 0, audio: 0 },
                  sumEmbeddedCardMedia(cursor.value as Card)
                )
              )
              cursor.delete()
              cursor.continue()
            } else {
              resolve()
            }
          }
          cursorRequest.onerror = () => reject(cursorRequest.error)
        })
      }
    )
  } catch (error) {
    restoreTopicInMemory(topicId, previousTopic)
    for (const card of previousCards) restoreCardInMemory(card.id, card)
    throw error
  }
  await adjustCardMediaStats(mediaDelta)
}

async function deleteLocalCard(cardId: string): Promise<void> {
  const previous = deleteCardFromMemory(cardId)
  try {
    await withTransaction(STORES.CARDS, 'readwrite', async stores => {
      await promisify(stores[STORES.CARDS].delete(cardId))
    })
  } catch (error) {
    restoreCardInMemory(cardId, previous)
    throw error
  }
  if (previous) await recordCardMediaDelete(previous)
}

async function getMeta(key: string): Promise<string | undefined> {
  const record = await withTransaction(STORES.SYNC_META, 'readonly', stores =>
    promisify<{ key: string; value: string } | undefined>(
      stores[STORES.SYNC_META].get(key)
    )
  )
  return record?.value
}

async function setMeta(key: string, value: string): Promise<void> {
  await withTransaction(STORES.SYNC_META, 'readwrite', async stores => {
    await promisify(stores[STORES.SYNC_META].put({ key, value }))
  })
}

async function getDeviceId(): Promise<string> {
  let id = await getMeta(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    await setMeta(DEVICE_ID_KEY, id)
  }
  return id
}

export { getDeviceId }

async function loadFailedOps(): Promise<FailedOp[]> {
  const raw = await getMeta(FAILED_OPS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as FailedOp[]
  } catch {
    return []
  }
}

async function saveFailedOps(ops: FailedOp[]): Promise<void> {
  await setMeta(FAILED_OPS_KEY, JSON.stringify(ops.slice(-50)))
  setState({ failedOps: ops.slice(-50) })
}

function backoffMs(attempts: number): number {
  return Math.min(300_000, 1000 * 2 ** attempts) + Math.random() * 1000
}

export interface SyncEnqueueOp {
  table: SyncTable
  recordId: string
  operation: SyncOperation
}

async function coalesceAndPutQueueItem(
  queueStore: IDBObjectStore,
  table: SyncTable,
  recordId: string,
  operation: SyncOperation
): Promise<void> {
  const queueId = `${table}:${recordId}`
  const existing = await promisify<QueueItem | undefined>(
    queueStore.get(queueId)
  )

  const next = coalesceQueuedOperation(
    existing?.operation,
    operation,
    existing != null && inFlightOpIds.has(existing.opId)
  )

  if (next === null) {
    if (existing) await promisify(queueStore.delete(queueId))
    return
  }

  // Always mint a new opId: the server skips any opId it already applied, so
  // reusing one (e.g. after a lost push ack) would silently drop the new body.
  // Only createdAt carries over, and only when the replaced op can't be mid-push.
  const opId = crypto.randomUUID()
  let createdAt = Date.now()
  if (existing?.operation === next && !inFlightOpIds.has(existing.opId)) {
    createdAt = existing.createdAt
  }

  await promisify(
    queueStore.put({
      id: queueId,
      opId,
      table,
      recordId,
      operation: next,
      createdAt,
      attempts: 0,
      nextRetryAt: 0
    } satisfies QueueItem)
  )
}

/** Write queue ops into an open IDBObjectStore (same transaction as local deletes). */
export async function putSyncQueueOps(
  queueStore: IDBObjectStore,
  ops: SyncEnqueueOp[]
): Promise<void> {
  if (!isBackendConfigured() || ops.length === 0) return
  for (const op of ops) {
    await coalesceAndPutQueueItem(
      queueStore,
      op.table,
      op.recordId,
      op.operation
    )
  }
}

export async function refreshSyncQueueDepth(): Promise<void> {
  if (!isBackendConfigured()) return
  setState({ queueDepth: (await getQueue()).length })
}

export async function enqueueSync(
  table: SyncTable,
  recordId: string,
  operation: SyncOperation
): Promise<void> {
  if (!isBackendConfigured()) return

  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    await coalesceAndPutQueueItem(
      stores[STORES.SYNC_QUEUE],
      table,
      recordId,
      operation
    )
  })

  await refreshSyncQueueDepth()
}

export async function enqueueSyncBulk(ops: SyncEnqueueOp[]): Promise<void> {
  if (!isBackendConfigured() || ops.length === 0) return

  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    await putSyncQueueOps(stores[STORES.SYNC_QUEUE], ops)
  })

  await refreshSyncQueueDepth()
}

async function getQueue(): Promise<QueueItem[]> {
  const items = await getAllLocal<QueueItem>(STORES.SYNC_QUEUE)
  return items.sort((a, b) => a.createdAt - b.createdAt)
}

async function removeQueueItem(id: string): Promise<void> {
  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    await promisify(stores[STORES.SYNC_QUEUE].delete(id))
  })
}

/** Remove only if the row still carries `opId` — a newer edit/delete may have replaced it mid-push. */
async function removeQueueItemIfOp(item: QueueItem): Promise<void> {
  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    const store = stores[STORES.SYNC_QUEUE]
    const current = await promisify<QueueItem | undefined>(store.get(item.id))
    if (current?.opId === item.opId) await promisify(store.delete(item.id))
  })
}

async function bumpQueueAttempts(item: QueueItem): Promise<void> {
  const next: QueueItem = {
    ...item,
    attempts: item.attempts + 1,
    nextRetryAt: Date.now() + backoffMs(item.attempts + 1)
  }
  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    const store = stores[STORES.SYNC_QUEUE]
    const current = await promisify<QueueItem | undefined>(store.get(item.id))
    if (current?.opId !== item.opId) return // replaced mid-push
    await promisify(store.put(next))
  })
}

export function topicToRecord(topic: Topic): TopicRecord {
  return {
    id: topic.id,
    title: topic.title,
    pivot: topic.pivot,
    weekJson: JSON.stringify(topic.week),
    nextUpdateDate: topic.nextUpdateDate,
    isArchived: topic.isArchived ?? false,
    updatedAt: topic.updatedAt ?? Date.now(),
    deletedAt: null
  }
}

async function cardToWireRecord(card: Card): Promise<{
  record: CardRecord
  mediaByHash: Map<string, MediaDBRecord>
}> {
  const { wireData, mediaByHash } = await prepareWireCardData(card.data)
  return {
    record: {
      id: card.id,
      topicId: card.topicId,
      level: card.level,
      dataJson: JSON.stringify(wireData),
      reviewDate: card.reviewDate ?? null,
      updatedAt: card.updatedAt ?? Date.now(),
      deletedAt: null
    },
    mediaByHash
  }
}

export function recordToTopic(record: TopicRecord): Topic {
  return rowToTopic({
    id: record.id,
    user_id: '',
    title: record.title,
    pivot: record.pivot,
    week: JSON.parse(record.weekJson),
    next_update_date: record.nextUpdateDate,
    is_archived: record.isArchived ?? false,
    updated_at: new Date(record.updatedAt).toISOString(),
    deleted_at:
      record.deletedAt != null ? new Date(record.deletedAt).toISOString() : null
  })
}

function recordToCard(record: CardRecord, data: CardRow['data']): Card {
  return rowToCard({
    id: record.id,
    user_id: '',
    topic_id: record.topicId,
    level: record.level,
    data,
    review_date: record.reviewDate ?? null,
    updated_at: new Date(record.updatedAt).toISOString(),
    deleted_at:
      record.deletedAt != null ? new Date(record.deletedAt).toISOString() : null
  })
}

// oxlint-disable-next-line sonarjs/cognitive-complexity
async function buildMutations(items: QueueItem[]): Promise<{
  mutations: Mutation[]
  items: QueueItem[]
  mediaByHash: Map<string, MediaDBRecord>
}> {
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
      table: item.table as 'topics' | 'cards',
      recordId: item.recordId,
      operation: item.operation as 'upsert' | 'delete',
      updatedAt: Date.now()
    }

    if (item.operation === 'delete') {
      // LWW needs when the delete happened, not when it was flushed: an offline
      // delete must not beat edits other devices made after it.
      if (!tryAdd(item, { ...base, updatedAt: item.createdAt })) break
      continue
    }

    if (item.table === STORES.TOPICS) {
      const topic = await getLocalRecord<Topic>(STORES.TOPICS, item.recordId)
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
      const card = await getLocalRecord<Card>(STORES.CARDS, item.recordId)
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

  const failed = await loadFailedOps()
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
  await saveFailedOps(failed)
  setState({ queueDepth: (await getQueue()).length })
}

async function applyTopicConflict(
  conflict: TopicConflictResolved
): Promise<void> {
  const local = await getLocalRecord<Topic>(STORES.TOPICS, conflict.topicId)
  if (!local) return
  local.title = conflict.newTitle
  local.updatedAt = conflict.updatedAt
  await putLocal(STORES.TOPICS, local)
  emitSyncData()

  if (
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('SYNC_DEBUG')
  ) {
    console.info('Topic renamed to avoid duplicate:', conflict)
  }
}

/** Shared incoming pipeline for HTTP pull, bootstrap/reconcile, and WS onDelta. */
export async function applyPullDelta(delta: PullDelta): Promise<void> {
  const progress = { mutated: false }
  try {
    await applyPullDeltaRecords(delta, progress)
  } finally {
    // One notification per batch, also when a later record fails after earlier
    // ones were already committed.
    if (progress.mutated) emitSyncData()
  }
}

// oxlint-disable-next-line sonarjs/cognitive-complexity
async function applyPullDeltaRecords(
  delta: PullDelta,
  progress: { mutated: boolean }
): Promise<void> {
  // Hydrate + verify all owned media before any local write or watermark bump.
  const hydratedCardData = await hydrateIncomingCardData(
    delta,
    httpSyncMediaApi
  )

  for (const record of delta.records) {
    if (record.topic) {
      const remote = record.topic

      const local = await getLocalRecord<Topic>(STORES.TOPICS, remote.id)

      if (remote.deletedAt) {
        // Tombstone is LWW too: a newer local edit survives an older delete.
        // oxlint-disable-next-line sonarjs/nested-control-flow
        if (local && shouldApplyRemote(local.updatedAt, remote.updatedAt)) {
          await deleteLocalTopic(remote.id)
          progress.mutated = true
        }
        continue
      }

      if (shouldApplyRemote(local?.updatedAt, remote.updatedAt)) {
        // Handle local title unique constraint: rename local clash if needed
        // oxlint-disable-next-line sonarjs/nested-control-flow
        try {
          await putLocal(STORES.TOPICS, recordToTopic(remote))
        } catch (err) {
          if ((err as Error).name === 'ConstraintError') {
            const renamed = recordToTopic(remote)
            renamed.title = `${renamed.title} (${renamed.id.slice(0, 4)})`
            await putLocal(STORES.TOPICS, renamed)
          } else {
            throw err
          }
        }
        progress.mutated = true
      }
    }

    if (record.card) {
      const remote = record.card

      const local = await getLocalRecord<Card>(STORES.CARDS, remote.id)

      if (remote.deletedAt) {
        // oxlint-disable-next-line sonarjs/nested-control-flow
        if (local && shouldApplyRemote(local.updatedAt, remote.updatedAt)) {
          await deleteLocalCard(remote.id)
          progress.mutated = true
        }
        continue
      }

      if (shouldApplyRemote(local?.updatedAt, remote.updatedAt)) {
        const data = hydratedCardData.get(remote.id)
        // oxlint-disable-next-line sonarjs/nested-control-flow
        if (data === undefined) {
          throw new Error(`Missing hydrated card data for ${remote.id}`)
        }
        await putLocal(
          STORES.CARDS,
          recordToCard(remote, data as CardRow['data'])
        )
        progress.mutated = true
      }
    }
  }

  // Fanout deltas carry an empty cursor: they cover one push, not a range.
  if (delta.watermark) {
    // Forward-only: a stale/out-of-order delta must never rewind the cursor.
    const prev = await getMeta('lastPulledAt')
    if (prev === undefined || isCursorAhead(delta.watermark, prev)) {
      await setMeta('lastPulledAt', delta.watermark)
    }
  }
}

/** Returns max updatedAt among accepted mutations. */
// oxlint-disable-next-line sonarjs/cognitive-complexity
export async function pushChanges(deviceId: string): Promise<number> {
  if (!syncBackend) return 0

  let rateLimitDelayMs = 2_000
  let maxAcceptedUpdatedAt = 0

  // Drain in batches — one MAX_PUSH_BATCH push leaves the rest stranded.
  while (true) {
    const queue = await getQueue()
    if (queue.length === 0) return maxAcceptedUpdatedAt

    const { mutations, items, mediaByHash } = await buildMutations(queue)
    if (mutations.length === 0) return maxAcceptedUpdatedAt

    for (const item of items) inFlightOpIds.add(item.opId)
    try {
      // Upload owned buffers before pushBatch so the server can HeadObject refs.
      await uploadOwnedMedia(mediaByHash, httpSyncMediaApi)

      let ack: PushAck
      if (realtime?.isActive() && realtime.pushBatch) {
        // oxlint-disable-next-line sonarjs/nested-control-flow
        try {
          ack = await realtime.pushBatch(mutations)
          setState({ connection: 'ws' })
        } catch {
          ack = await syncBackend.push({ deviceId, mutations })
          setState({ connection: 'http' })
        }
      } else {
        ack = await syncBackend.push({ deviceId, mutations })
        setState({ connection: 'http' })
      }

      const accepted = new Set(ack.acceptedOpIds)
      for (const m of mutations) {
        // oxlint-disable-next-line sonarjs/nested-control-flow
        if (accepted.has(m.opId)) {
          maxAcceptedUpdatedAt = Math.max(maxAcceptedUpdatedAt, m.updatedAt)
        }
      }

      await applyPushAck(ack, items)

      for (const conflict of ack.conflicts) {
        await applyTopicConflict(conflict)
      }
      rateLimitDelayMs = 2_000
    } catch (err) {
      const limited =
        err instanceof ApiError &&
        (err.code === 'RATE_LIMITED' || err.status === 429)
      if (!limited) throw err

      await new Promise<void>(resolve => setTimeout(resolve, rateLimitDelayMs))
      rateLimitDelayMs = Math.min(60_000, rateLimitDelayMs * 2)
    } finally {
      for (const item of items) inFlightOpIds.delete(item.opId)
    }
  }
}

async function pullChanges(deviceId: string): Promise<void> {
  if (!syncBackend) return
  let since = (await getMeta('lastPulledAt')) ?? INITIAL_CURSOR
  for (;;) {
    const delta = await syncBackend.pull({ deviceId, since })
    await applyPullDelta(delta)
    if (!delta.more) return
    since = delta.watermark || ((await getMeta('lastPulledAt')) ?? since)
  }
}

async function reconcile(): Promise<void> {
  if (!syncBackend) return
  const deviceId = await getDeviceId()
  const delta = await syncBackend.bootstrap({
    deviceId,
    lastPulledAt: INITIAL_CURSOR,
    pendingOpCount: (await getQueue()).length
  })
  await applyPullDelta(delta)
  if (delta.more) await pullChanges(deviceId)
}

function wireRealtimeListeners(): void {
  if (!syncBackend?.connectRealtime) return

  realtime = syncBackend.connectRealtime({
    onDelta: delta => {
      void applyPullDelta(delta).catch(err => {
        console.error('WS delta apply failed:', err)
        // Hydrate/verify failed before watermark advance — HTTP pull retries the range.
        void (async () => {
          try {
            await pullChanges(await getDeviceId())
          } catch (retryErr) {
            console.error('WS delta retry pull failed:', retryErr)
          }
        })()
      })
    },
    onConflict: conflict => {
      void applyTopicConflict(conflict).catch(err =>
        console.error('WS conflict apply failed:', err)
      )
    },
    onStateChange: wsState => {
      if (wsState === 'active') {
        setState({ connection: 'ws' })
        void flushAfterConnect()
      } else if (wsState === 'disconnected' && state.connection === 'ws') {
        setState({ connection: 'idle' })
      }
    },
    onTokenExpired: () => {
      void ensureRealtimeReconnectWithFreshToken()
    },
    onPlanRequired: () => {
      pauseSync()
    },
    onDeviceRevoked: () => {
      markDeviceRevoked()
    },
    onProtocolMismatch: () => {
      markUpdateRequired()
    }
  })
}

async function ensureRealtimeReconnectWithFreshToken(): Promise<void> {
  realtime?.disconnect()
  if (!currentUserId || !syncEntitled || !realtime) return
  const deviceId = await getDeviceId()
  const lastPulledAt = (await getMeta('lastPulledAt')) ?? INITIAL_CURSOR
  await realtime.connect({
    deviceId,
    lastPulledAt,
    pendingOpCount: (await getQueue()).length
  })
}

async function flushAfterConnect(): Promise<void> {
  if (!currentUserId || !syncEntitled) return
  try {
    const deviceId = await getDeviceId()
    await pushChanges(deviceId)
  } catch (err) {
    console.error('Post-connect flush failed:', err)
  }
}

async function connectRealtime(): Promise<void> {
  if (!syncEntitled || !realtime) return
  const deviceId = await getDeviceId()
  const lastPulledAt = (await getMeta('lastPulledAt')) ?? INITIAL_CURSOR
  realtime.updateResume?.(lastPulledAt, (await getQueue()).length)
  await realtime.connect({
    deviceId,
    lastPulledAt,
    pendingOpCount: (await getQueue()).length
  })
}

export async function syncAll(_userId: string): Promise<void> {
  if (!syncEntitled || !isBackendConfigured() || !syncBackend) {
    return
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setState({ status: 'offline', connection: 'offline' })
    return
  }

  if (pendingClear) {
    // The previous account is still being wiped; syncing now would mix the two.
    await pendingClear
    if (!syncEntitled || !currentUserId) return
  }

  if (syncMutex) {
    // Edits made while a run is in flight may have missed its push — rerun after.
    pendingSyncAll = true
    return syncMutex
  }

  return withSyncMutex(runSyncAllPasses)
}

/** Loop push+pull while another syncAll was requested during the run. */
async function runSyncAllPasses(): Promise<void> {
  do {
    pendingSyncAll = false
    await runSyncAllOnce()
  } while (pendingSyncAll && syncEntitled && currentUserId)
  pendingSyncAll = false
}

async function runSyncAllOnce(): Promise<void> {
  setState({ status: 'syncing', lastError: null })

  try {
    const deviceId = await getDeviceId()
    setState({ deviceId })

    const lastSyncAt = await getMeta(LAST_SYNC_AT_KEY)
    if (
      lastSyncAt !== undefined &&
      Date.now() - Number(lastSyncAt) > ACTIVE_WINDOW_MS
    ) {
      await reconcile()
    }

    await pushChanges(deviceId)
    // Always pull after push: the server may have kept a different (winning)
    // row for something we just pushed. Watermark only moves forward.
    await pullChanges(deviceId)

    await setMeta(LAST_SYNC_AT_KEY, String(Date.now()))
    setState({
      status: 'idle',
      lastSyncedAt: Date.now(),
      queueDepth: (await getQueue()).length
    })

    if (realtime && !realtime.isActive()) {
      await connectRealtime()
    }
  } catch (error) {
    console.error('Sync failed:', error)
    if (handleSyncAccessError(error)) {
      pendingSyncAll = false
      return
    }
    setState({
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Sync failed'
    })
  }
}

/** Wipe local study data + queue (sign-out / account switch). Keeps deviceId. */
export async function clearLocalSyncData(): Promise<void> {
  const snap = {
    topics: getAllTopicsFromMemory(),
    cards: getAllCardsFromMemory()
  }
  clearStudyMemory()
  emitSyncData()
  try {
    await withTransaction(
      [STORES.TOPICS, STORES.CARDS, STORES.SYNC_QUEUE, STORES.SYNC_META],
      'readwrite',
      async stores => {
        await promisify(stores[STORES.TOPICS].clear())
        await promisify(stores[STORES.CARDS].clear())
        await promisify(stores[STORES.SYNC_QUEUE].clear())

        const meta = stores[STORES.SYNC_META]
        const rows = await promisify<{ key: string }[]>(meta.getAll())
        for (const row of rows) {
          if (row.key !== DEVICE_ID_KEY) await promisify(meta.delete(row.key))
        }
        await promisify(
          meta.put({ key: 'lastPulledAt', value: INITIAL_CURSOR })
        )
      }
    )
  } catch (error) {
    for (const topic of snap.topics) putTopicInMemory(topic)
    for (const card of snap.cards) putCardInMemory(card)
    emitSyncData()
    throw error
  }
  setState({ queueDepth: 0, failedOps: [] })
}

/** Test-only: drop module-level sync state so tests don't leak into each other. */
export function __resetSyncServiceForTests(): void {
  syncMutex = null
  pendingSyncAll = false
  pendingClear = null
  syncEntitled = false
  currentUserId = null
  realtime = null
  if (triggerTimer) clearTimeout(triggerTimer)
  triggerTimer = null
  inFlightOpIds.clear()
  state = {
    status: 'idle',
    lastSyncedAt: null,
    connection: 'idle',
    queueDepth: 0,
    deviceId: null,
    lastError: null,
    failedOps: []
  }
}

async function migrateLocalToCloud(): Promise<void> {
  const [topics, cards] = await Promise.all([
    getAllLocal<Topic>(STORES.TOPICS),
    getAllLocal<Card>(STORES.CARDS)
  ])

  for (const topic of topics) {
    await enqueueSync(STORES.TOPICS, topic.id, 'upsert')
  }
  for (const card of cards) {
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
  }
}

/**
 * Wipe the account we just left, after its in-flight run ends. Wiping under a
 * running sync lets a late pull re-seed the store with that account's rows,
 * which the next sign-in would then adopt as guest data.
 */
function scheduleAccountWipe(): void {
  const previousWipe = pendingClear ?? Promise.resolve()
  const wipe: Promise<void> = (async () => {
    await previousWipe
    if (syncMutex) await settleWithin(syncMutex, WIPE_WAIT_RUN_MS)
    await clearLocalSyncData()
  })()
    .catch(err => console.error('Account wipe failed:', err))
    .finally(() => {
      if (pendingClear === wipe) pendingClear = null
    })
  pendingClear = wipe
}

export function setSyncUser(userId: string | null): void {
  const previousUserId = currentUserId
  const changed = previousUserId !== userId
  if (changed) {
    syncEntitled = false
    pendingSyncAll = false
    if (triggerTimer) clearTimeout(triggerTimer)
    triggerTimer = null
    // The socket is authenticated as the old account.
    realtime?.disconnect()
  }
  currentUserId = userId

  // Leaving an account (sign-out or direct switch) wipes it. The initial
  // signed-out render must not erase guest data, so null -> X never wipes.
  if (changed && previousUserId !== null) scheduleAccountWipe()

  if (!userId) {
    setState({
      status: 'idle',
      connection: 'idle',
      deviceId: null,
      lastError: null,
      failedOps: []
    })
  } else {
    void loadFailedOps().then(ops => setState({ failedOps: ops }))
    void getDeviceId().then(id => setState({ deviceId: id }))
    void getQueue().then(q => setState({ queueDepth: q.length }))
  }
}

/**
 * Best-effort push of the outbox before the session is dropped. Returns how
 * many queued changes are still unsynced (offline, not entitled, rejected or
 * timed out) so the caller can warn before they are wiped.
 */
export async function flushPendingChanges(
  timeoutMs = SIGN_OUT_FLUSH_TIMEOUT_MS
): Promise<number> {
  if (currentUserId && syncEntitled && isBackendConfigured() && syncBackend) {
    await settleWithin(syncAll(currentUserId), timeoutMs)
  }
  return (await getQueue()).length
}

export function setSyncEntitlement(entitled: boolean): boolean {
  const becameEntitled = entitled && !syncEntitled
  syncEntitled = entitled
  if (!entitled) {
    if (currentUserId) pauseSync()
    else realtime?.disconnect()
  } else if (currentUserId && state.status === 'paused') {
    setState({ status: 'idle', lastError: null })
  }
  return becameEntitled
}

export async function initialSync(userId: string): Promise<void> {
  if (!syncEntitled || !isBackendConfigured() || !syncBackend) {
    return
  }

  // Before the single-flight check: the previous account's run may still hold
  // the mutex, and joining it would swallow this call.
  if (pendingClear) {
    await pendingClear
    if (!syncEntitled || currentUserId !== userId) return
  }

  if (syncMutex) {
    return syncMutex
  }

  return withSyncMutex(async () => {
    wireRealtimeListeners()

    const migratedUserId = await getMeta('migratedUserId')
    if (migratedUserId !== userId) {
      if (migratedUserId === undefined) {
        // Guest data from before first sign-in: adopt into this account.
        await migrateLocalToCloud()
      } else {
        // Another account's data lives here — never upload it as this user's.
        await clearLocalSyncData()
      }
      await setMeta('migratedUserId', userId)
    }

    const deviceId = await getDeviceId()
    setState({ deviceId })

    try {
      setState({ status: 'syncing' })
      const lastPulledAt = (await getMeta('lastPulledAt')) ?? INITIAL_CURSOR
      const delta = await syncBackend!.bootstrap({
        deviceId,
        lastPulledAt,
        pendingOpCount: (await getQueue()).length
      })
      await applyPullDelta(delta)
      if (delta.more) await pullChanges(deviceId)
      await pushChanges(deviceId)
      await setMeta(LAST_SYNC_AT_KEY, String(Date.now()))
      setState({
        status: 'idle',
        lastSyncedAt: Date.now(),
        queueDepth: (await getQueue()).length
      })
    } catch (error) {
      console.error('Initial sync failed:', error)
      if (handleSyncAccessError(error)) return
      setState({
        status: 'error',
        lastError:
          error instanceof Error ? error.message : 'Initial sync failed'
      })
    }

    await connectRealtime()

    // A syncAll arrived mid-initialSync (single-flight): honour it now.
    if (pendingSyncAll) await runSyncAllPasses()
  })
}

/** Mint a new sync deviceId and rejoin after DEVICE_REVOKED. Uses a Pro slot. */
export async function reconnectRevokedDevice(): Promise<void> {
  if (
    !currentUserId ||
    !syncEntitled ||
    !isBackendConfigured() ||
    !syncBackend
  ) {
    return
  }
  if (state.status === 'syncing') return

  realtime?.disconnect()

  const deviceId = crypto.randomUUID()
  await setMeta(DEVICE_ID_KEY, deviceId)
  setState({ deviceId, status: 'syncing', lastError: null })

  return withSyncMutex(async () => {
    wireRealtimeListeners()
    try {
      const lastPulledAt = (await getMeta('lastPulledAt')) ?? INITIAL_CURSOR
      const delta = await syncBackend!.bootstrap({
        deviceId,
        lastPulledAt,
        pendingOpCount: (await getQueue()).length
      })
      await applyPullDelta(delta)
      if (delta.more) await pullChanges(deviceId)
      await pushChanges(deviceId)
      await setMeta(LAST_SYNC_AT_KEY, String(Date.now()))
      setState({
        status: 'idle',
        lastSyncedAt: Date.now(),
        queueDepth: (await getQueue()).length
      })
      await connectRealtime()
    } catch (error) {
      console.error('Reconnect sync failed:', error)
      if (handleSyncAccessError(error)) return
      setState({
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Reconnect failed'
      })
    }
  })
}

export function syncNow(): void {
  if (
    !currentUserId ||
    !syncEntitled ||
    state.status === 'revoked' ||
    state.status === 'update_required'
  )
    return
  void syncAll(currentUserId)
}

export function triggerSync(): void {
  if (
    !currentUserId ||
    !syncEntitled ||
    state.status === 'revoked' ||
    state.status === 'update_required' ||
    !isBackendConfigured()
  )
    return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  if (triggerTimer) clearTimeout(triggerTimer)
  triggerTimer = setTimeout(() => {
    triggerTimer = null
    if (currentUserId) void syncAll(currentUserId)
  }, TRIGGER_DEBOUNCE_MS)
}

export async function getSyncDiagnostics(): Promise<{
  deviceId: string
  lastPulledAt: string
  queueDepth: number
  wsState: WsConnectionState
  failedOps: FailedOp[]
}> {
  const deviceId = await getDeviceId()
  const wsState: WsConnectionState = realtime?.isActive()
    ? 'active'
    : 'disconnected'
  return {
    deviceId,
    lastPulledAt: (await getMeta('lastPulledAt')) ?? INITIAL_CURSOR,
    queueDepth: (await getQueue()).length,
    wsState,
    failedOps: await loadFailedOps()
  }
}
