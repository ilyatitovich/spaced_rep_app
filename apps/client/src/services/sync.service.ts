import type {
  Mutation,
  PullDelta,
  PushAck,
  TopicConflictResolved,
  TopicRecord,
  CardRecord
} from '@spaced-rep/sync-protocol'
import { STORES, withTransaction } from '@/lib/db'
import {
  cardToRow,
  rowToCard,
  rowToTopic,
  shouldApplyRemote
} from '@/lib/sync-serialize'
import { Card, Topic } from '@/models'
import {
  httpBootstrap,
  httpPull,
  httpPushBatch,
  isServerSyncConfigured
} from './sync-http.client'
import { syncWsManager, type WsConnectionState } from './sync-ws.manager'

type SyncTable = typeof STORES.TOPICS | typeof STORES.CARDS
type SyncOperation = 'upsert' | 'delete'

type QueueItem = {
  id: string
  opId: string
  table: SyncTable
  recordId: string
  operation: SyncOperation
  createdAt: number
  attempts: number
  nextRetryAt: number
}

type FailedOp = {
  opId: string
  table: SyncTable
  recordId: string
  code: string
  message: string
  at: number
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export type SyncConnection = 'ws' | 'http' | 'offline' | 'idle'

export type SyncState = {
  status: SyncStatus
  lastSyncedAt: number | null
  connection: SyncConnection
  queueDepth: number
  deviceId: string | null
  lastError: string | null
  failedOps: FailedOp[]
}

const EPOCH_ISO = new Date(0).toISOString()
const TRIGGER_DEBOUNCE_MS = 1500
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const DEVICE_ID_KEY = 'deviceId'
const LAST_SYNC_AT_KEY = 'lastSyncAt'
const FAILED_OPS_KEY = 'failedOps'
const MAX_PUSH_BATCH = 50
const MAX_ATTEMPTS = 10

let currentUserId: string | null = null
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
let syncInFlight = false

const listeners = new Set<(state: SyncState) => void>()
const dataListeners = new Set<() => void>()

function setState(next: Partial<SyncState>): void {
  state = { ...state, ...next }
  listeners.forEach(listener => listener(state))
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
  dataListeners.add(listener)
  return () => dataListeners.delete(listener)
}

function emitSyncData(): void {
  dataListeners.forEach(listener => listener())
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
  return withTransaction(table, 'readonly', stores =>
    promisify<T>(stores[table].get(id))
  )
}

async function getAllLocal<T>(table: SyncTable): Promise<T[]> {
  return withTransaction(table, 'readonly', stores =>
    promisify<T[]>(stores[table].getAll())
  )
}

async function putLocal(table: SyncTable, value: Topic | Card): Promise<void> {
  await withTransaction(table, 'readwrite', async stores => {
    await promisify(stores[table].put(value))
  })
}

async function deleteLocalTopic(topicId: string): Promise<void> {
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
}

async function deleteLocalCard(cardId: string): Promise<void> {
  await withTransaction(STORES.CARDS, 'readwrite', async stores => {
    await promisify(stores[STORES.CARDS].delete(cardId))
  })
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

export async function enqueueSync(
  table: SyncTable,
  recordId: string,
  operation: SyncOperation
): Promise<void> {
  if (!isServerSyncConfigured()) return

  const queueId = `${table}:${recordId}`
  const existing = await withTransaction(
    STORES.SYNC_QUEUE,
    'readonly',
    stores => promisify<QueueItem | undefined>(stores[STORES.SYNC_QUEUE].get(queueId))
  )

  let opId: string = crypto.randomUUID()
  let createdAt = Date.now()
  if (existing) {
    if (existing.operation === operation) {
      opId = existing.opId
      createdAt = existing.createdAt
    }
    // operation flip → new opId
  }

  const item: QueueItem = {
    id: queueId,
    opId,
    table,
    recordId,
    operation,
    createdAt,
    attempts: 0,
    nextRetryAt: 0
  }

  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    await promisify(stores[STORES.SYNC_QUEUE].put(item))
  })

  const depth = (await getQueue()).length
  setState({ queueDepth: depth })
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

async function bumpQueueAttempts(item: QueueItem): Promise<void> {
  const next: QueueItem = {
    ...item,
    attempts: item.attempts + 1,
    nextRetryAt: Date.now() + backoffMs(item.attempts + 1)
  }
  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    await promisify(stores[STORES.SYNC_QUEUE].put(next))
  })
}

function topicToRecord(topic: Topic): TopicRecord {
  return {
    id: topic.id,
    title: topic.title,
    pivot: topic.pivot,
    weekJson: JSON.stringify(topic.week),
    nextUpdateDate: topic.nextUpdateDate,
    updatedAt: topic.updatedAt ?? Date.now(),
    deletedAt: null
  }
}

function cardToRecord(card: Card): CardRecord {
  const row = cardToRow(card, '')
  return {
    id: card.id,
    topicId: card.topicId,
    level: card.level,
    dataJson: JSON.stringify(row.data),
    reviewDate: card.reviewDate ?? null,
    updatedAt: card.updatedAt ?? Date.now(),
    deletedAt: null
  }
}

function recordToTopic(record: TopicRecord): Topic {
  return rowToTopic({
    id: record.id,
    user_id: '',
    title: record.title,
    pivot: record.pivot,
    week: JSON.parse(record.weekJson),
    next_update_date: record.nextUpdateDate,
    updated_at: new Date(record.updatedAt).toISOString(),
    deleted_at:
      record.deletedAt != null
        ? new Date(record.deletedAt).toISOString()
        : null
  })
}

function recordToCard(record: CardRecord): Card {
  return rowToCard({
    id: record.id,
    user_id: '',
    topic_id: record.topicId,
    level: record.level,
    data: JSON.parse(record.dataJson),
    review_date: record.reviewDate ?? null,
    updated_at: new Date(record.updatedAt).toISOString(),
    deleted_at:
      record.deletedAt != null
        ? new Date(record.deletedAt).toISOString()
        : null
  })
}

async function buildMutations(items: QueueItem[]): Promise<{
  mutations: Mutation[]
  items: QueueItem[]
}> {
  const deviceId = await getDeviceId()
  const mutations: Mutation[] = []
  const included: QueueItem[] = []

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
      mutations.push(base)
      included.push(item)
      continue
    }

    if (item.table === STORES.TOPICS) {
      const topic = await getLocalRecord<Topic>(STORES.TOPICS, item.recordId)
      if (!topic) {
        await removeQueueItem(item.id)
        continue
      }
      mutations.push({
        ...base,
        updatedAt: topic.updatedAt ?? Date.now(),
        topic: topicToRecord(topic)
      })
      included.push(item)
    } else {
      const card = await getLocalRecord<Card>(STORES.CARDS, item.recordId)
      if (!card) {
        await removeQueueItem(item.id)
        continue
      }
      mutations.push({
        ...base,
        updatedAt: card.updatedAt ?? Date.now(),
        card: cardToRecord(card)
      })
      included.push(item)
    }
  }

  return { mutations, items: included }
}

async function applyPushAck(
  ack: PushAck,
  items: QueueItem[]
): Promise<void> {
  const byOpId = new Map(items.map(i => [i.opId, i]))

  for (const opId of ack.acceptedOpIds) {
    const item = byOpId.get(opId)
    if (item) await removeQueueItem(item.id)
  }

  for (const conflict of ack.conflicts) {
    await applyTopicConflict(conflict)
    const item = [...byOpId.values()].find(
      i => i.recordId === conflict.topicId
    )
    if (item) await removeQueueItem(item.id)
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
      await removeQueueItem(item.id)
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

  if (typeof localStorage !== 'undefined' && localStorage.getItem('SYNC_DEBUG')) {
    console.info('Topic renamed to avoid duplicate:', conflict)
  }
}

async function applyPullDelta(delta: PullDelta): Promise<void> {
  let didMutateLocal = false
  let maxUpdatedAt = 0

  for (const record of delta.records) {
    if (record.topic) {
      const remote = record.topic
      maxUpdatedAt = Math.max(maxUpdatedAt, remote.updatedAt)

      if (remote.deletedAt) {
        await deleteLocalTopic(remote.id)
        didMutateLocal = true
        continue
      }

      const local = await getLocalRecord<Topic>(STORES.TOPICS, remote.id)
      if (shouldApplyRemote(local?.updatedAt, remote.updatedAt)) {
        // Handle local title unique constraint: rename local clash if needed
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
        didMutateLocal = true
      }
    }

    if (record.card) {
      const remote = record.card
      maxUpdatedAt = Math.max(maxUpdatedAt, remote.updatedAt)

      if (remote.deletedAt) {
        await deleteLocalCard(remote.id)
        didMutateLocal = true
        continue
      }

      const local = await getLocalRecord<Card>(STORES.CARDS, remote.id)
      if (shouldApplyRemote(local?.updatedAt, remote.updatedAt)) {
        await putLocal(STORES.CARDS, recordToCard(remote))
        didMutateLocal = true
      }
    }
  }

  if (delta.watermark) {
    await setMeta('lastPulledAt', delta.watermark)
  } else if (maxUpdatedAt > 0) {
    await setMeta('lastPulledAt', new Date(maxUpdatedAt).toISOString())
  }

  if (didMutateLocal) emitSyncData()
}

async function pushChanges(deviceId: string): Promise<void> {
  const queue = await getQueue()
  if (queue.length === 0) return

  const { mutations, items } = await buildMutations(queue)
  if (mutations.length === 0) return

  let ack: PushAck
  const wsActive = syncWsManager.isActive()
  if (wsActive) {
    try {
      ack = await syncWsManager.pushBatch(mutations)
      setState({ connection: 'ws' })
    } catch {
      ack = await httpPushBatch({ deviceId, mutations })
      setState({ connection: 'http' })
    }
  } else {
    ack = await httpPushBatch({ deviceId, mutations })
    setState({ connection: 'http' })
  }

  await applyPushAck(ack, items)

  for (const conflict of ack.conflicts) {
    await applyTopicConflict(conflict)
  }
}

async function pullChanges(deviceId: string): Promise<void> {
  const lastPulledAt = (await getMeta('lastPulledAt')) ?? EPOCH_ISO
  const delta = await httpPull({ deviceId, since: lastPulledAt })
  await applyPullDelta(delta)
}

async function reconcile(): Promise<void> {
  // After long absence, bootstrap from epoch and drop local orphans via pull tombstones.
  // Full ID reconcile requires live id list — use bootstrap pull as approximation.
  const deviceId = await getDeviceId()
  const delta = await httpBootstrap({
    deviceId,
    lastPulledAt: EPOCH_ISO,
    pendingOpCount: (await getQueue()).length
  })
  await applyPullDelta(delta)
}

function wireWsListeners(): void {
  syncWsManager.setListeners({
    onDelta: delta => {
      void applyPullDelta(delta).catch(err =>
        console.error('WS delta apply failed:', err)
      )
    },
    onConflict: conflict => {
      void applyTopicConflict(conflict).catch(err =>
        console.error('WS conflict apply failed:', err)
      )
    },
    onStateChange: (wsState: WsConnectionState) => {
      if (wsState === 'active') {
        setState({ connection: 'ws' })
        void flushAfterConnect()
      } else if (wsState === 'disconnected') {
        if (state.connection === 'ws') setState({ connection: 'idle' })
      }
    },
    onTokenExpired: () => {
      void ensureWsReconnectWithFreshToken()
    }
  })
}

async function ensureWsReconnectWithFreshToken(): Promise<void> {
  syncWsManager.disconnect()
  if (!currentUserId) return
  const deviceId = await getDeviceId()
  const lastPulledAt = (await getMeta('lastPulledAt')) ?? EPOCH_ISO
  await syncWsManager.connect({
    deviceId,
    lastPulledAt,
    pendingOpCount: (await getQueue()).length
  })
}

async function flushAfterConnect(): Promise<void> {
  if (!currentUserId) return
  try {
    const deviceId = await getDeviceId()
    await pushChanges(deviceId)
  } catch (err) {
    console.error('Post-connect flush failed:', err)
  }
}

async function connectWs(): Promise<void> {
  const deviceId = await getDeviceId()
  const lastPulledAt = (await getMeta('lastPulledAt')) ?? EPOCH_ISO
  syncWsManager.updateResume(lastPulledAt, (await getQueue()).length)
  await syncWsManager.connect({
    deviceId,
    lastPulledAt,
    pendingOpCount: (await getQueue()).length
  })
}

export async function syncAll(_userId: string): Promise<void> {
  if (!isServerSyncConfigured()) return
  if (syncInFlight) return

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setState({ status: 'offline', connection: 'offline' })
    return
  }

  syncInFlight = true
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
    await pullChanges(deviceId)

    await setMeta(LAST_SYNC_AT_KEY, String(Date.now()))
    setState({
      status: 'idle',
      lastSyncedAt: Date.now(),
      queueDepth: (await getQueue()).length
    })

    if (!syncWsManager.isActive()) {
      await connectWs()
    }
  } catch (error) {
    console.error('Sync failed:', error)
    setState({
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Sync failed'
    })
  } finally {
    syncInFlight = false
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

export function setSyncUser(userId: string | null): void {
  currentUserId = userId
  if (!userId) {
    syncWsManager.disconnect()
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

export async function initialSync(userId: string): Promise<void> {
  if (!isServerSyncConfigured()) return

  wireWsListeners()

  const migratedUserId = await getMeta('migratedUserId')
  if (migratedUserId !== userId) {
    await migrateLocalToCloud()
    await setMeta('migratedUserId', userId)
  }

  const deviceId = await getDeviceId()
  setState({ deviceId })

  try {
    setState({ status: 'syncing' })
    const lastPulledAt = (await getMeta('lastPulledAt')) ?? EPOCH_ISO
    const delta = await httpBootstrap({
      deviceId,
      lastPulledAt,
      pendingOpCount: (await getQueue()).length
    })
    await applyPullDelta(delta)
    await pushChanges(deviceId)
    await setMeta(LAST_SYNC_AT_KEY, String(Date.now()))
    setState({
      status: 'idle',
      lastSyncedAt: Date.now(),
      queueDepth: (await getQueue()).length
    })
  } catch (error) {
    console.error('Initial sync failed:', error)
    setState({
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Initial sync failed'
    })
  }

  await connectWs()
}

export function syncNow(): void {
  if (!currentUserId) return
  void syncAll(currentUserId)
}

export function triggerSync(): void {
  if (!currentUserId || !isServerSyncConfigured()) return
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
  return {
    deviceId,
    lastPulledAt: (await getMeta('lastPulledAt')) ?? EPOCH_ISO,
    queueDepth: (await getQueue()).length,
    wsState: syncWsManager.getState(),
    failedOps: await loadFailedOps()
  }
}
