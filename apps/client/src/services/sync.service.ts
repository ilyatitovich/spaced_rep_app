import { STORES, withTransaction } from '@/lib/db'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  cardToRow,
  rowToCard,
  rowToTopic,
  shouldApplyRemote,
  topicToRow,
  type CardRow,
  type TopicRow
} from '@/lib/sync-serialize'
import { Card, Topic } from '@/models'

type SyncTable = typeof STORES.TOPICS | typeof STORES.CARDS
type SyncOperation = 'upsert' | 'delete'

type QueueItem = {
  id: string
  table: SyncTable
  recordId: string
  operation: SyncOperation
  createdAt: number
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export type SyncState = {
  status: SyncStatus
  lastSyncedAt: number | null
}

const EPOCH_ISO = new Date(0).toISOString()
const TRIGGER_DEBOUNCE_MS = 1500

// A device counts as active if it has synced within this window. Tombstones are
// GC'd once every active device has pulled past them, or once older than this
// window (safety net so a lost device can't block cleanup forever).
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const DEVICE_ID_KEY = 'deviceId'
const LAST_SYNC_AT_KEY = 'lastSyncAt'

let currentUserId: string | null = null
let state: SyncState = { status: 'idle', lastSyncedAt: null }
let triggerTimer: ReturnType<typeof setTimeout> | null = null

const listeners = new Set<(state: SyncState) => void>()

// Notifies subscribers whenever the local database is mutated by a remote pull,
// so the state manager layer can refresh itself and re-render the UI.
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

// --- IndexedDB helpers (write directly, never re-enqueue) ---

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

// --- Queue ---

export async function enqueueSync(
  table: SyncTable,
  recordId: string,
  operation: SyncOperation
): Promise<void> {
  // Local-first: queue mutations even while logged out so they push on login.
  if (!isSupabaseConfigured) return

  const item: QueueItem = {
    id: `${table}:${recordId}`,
    table,
    recordId,
    operation,
    createdAt: Date.now()
  }

  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    await promisify(stores[STORES.SYNC_QUEUE].put(item))
  })
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

// --- Push / pull ---

async function pushChanges(userId: string, hardDelete: boolean): Promise<void> {
  const queue = await getQueue()

  for (const item of queue) {
    if (item.operation === 'delete') {
      if (hardDelete) {
        // Only this device is active, so no other device needs the tombstone.
        // Deleting a topic cascades to its cards; leftover card deletes no-op.
        const { error } = await supabase
          .from(item.table)
          .delete()
          .eq('id', item.recordId)
          .eq('user_id', userId)

        if (error) throw error
      } else {
        const now = new Date().toISOString()
        const { error } = await supabase
          .from(item.table)
          .update({ deleted_at: now, updated_at: now })
          .eq('id', item.recordId)
          .eq('user_id', userId)

        if (error) throw error
      }
    } else {
      if (item.table === STORES.TOPICS) {
        const topic = await getLocalRecord<Topic>(STORES.TOPICS, item.recordId)
        if (topic) {
          const { error } = await supabase
            .from(STORES.TOPICS)
            .upsert(topicToRow(topic, userId))
          if (error) throw error
        }
      } else {
        const card = await getLocalRecord<Card>(STORES.CARDS, item.recordId)
        if (card) {
          const { error } = await supabase
            .from(STORES.CARDS)
            .upsert(cardToRow(card, userId))
          if (error) throw error
        }
      }
    }

    await removeQueueItem(item.id)
  }
}

async function pullChanges(userId: string): Promise<void> {
  const lastPulledAt = (await getMeta('lastPulledAt')) ?? EPOCH_ISO

  const topicsResult = await supabase
    .from(STORES.TOPICS)
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', lastPulledAt)

  if (topicsResult.error) throw topicsResult.error

  const cardsResult = await supabase
    .from(STORES.CARDS)
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', lastPulledAt)

  if (cardsResult.error) throw cardsResult.error

  const topicRows = (topicsResult.data ?? []) as TopicRow[]
  const cardRows = (cardsResult.data ?? []) as CardRow[]

  let maxUpdatedAt = new Date(lastPulledAt).getTime()
  let didMutateLocal = false

  for (const row of topicRows) {
    const remoteMs = new Date(row.updated_at).getTime()
    maxUpdatedAt = Math.max(maxUpdatedAt, remoteMs)

    if (row.deleted_at) {
      await deleteLocalTopic(row.id)
      didMutateLocal = true
      continue
    }

    const local = await getLocalRecord<Topic>(STORES.TOPICS, row.id)
    if (shouldApplyRemote(local?.updatedAt, remoteMs)) {
      await putLocal(STORES.TOPICS, rowToTopic(row))
      didMutateLocal = true
    }
  }

  for (const row of cardRows) {
    const remoteMs = new Date(row.updated_at).getTime()
    maxUpdatedAt = Math.max(maxUpdatedAt, remoteMs)

    if (row.deleted_at) {
      await deleteLocalCard(row.id)
      didMutateLocal = true
      continue
    }

    const local = await getLocalRecord<Card>(STORES.CARDS, row.id)
    if (shouldApplyRemote(local?.updatedAt, remoteMs)) {
      await putLocal(STORES.CARDS, rowToCard(row))
      didMutateLocal = true
    }
  }

  if (topicRows.length > 0 || cardRows.length > 0) {
    await setMeta('lastPulledAt', new Date(maxUpdatedAt).toISOString())
  }

  // Let the state manager layer know the local DB changed so it can refresh.
  if (didMutateLocal) {
    emitSyncData()
  }
}

// --- Device registry & tombstone GC ---

async function countOtherActiveDevices(
  userId: string,
  deviceId: string
): Promise<number> {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString()
  const { count, error } = await supabase
    .from('sync_devices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('id', deviceId)
    .gt('last_seen_at', cutoff)

  if (error) throw error
  return count ?? 0
}

async function reportDevice(userId: string, deviceId: string): Promise<void> {
  const lastPulledAt = (await getMeta('lastPulledAt')) ?? EPOCH_ISO
  const { error } = await supabase.from('sync_devices').upsert({
    id: deviceId,
    user_id: userId,
    last_pulled_at: lastPulledAt,
    last_seen_at: new Date().toISOString(),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
  })
  if (error) throw error
}

async function purgeTombstones(): Promise<void> {
  const { error } = await supabase.rpc('purge_synced_tombstones')
  if (error) throw error
}

// After a long absence, tombstones this device never saw may already be GC'd,
// so an incremental pull can't learn about them. Drop local rows that are no
// longer live remotely (unless a local mutation for them is still pending).
async function reconcile(userId: string): Promise<void> {
  const [topicsResult, cardsResult] = await Promise.all([
    supabase
      .from(STORES.TOPICS)
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null),
    supabase
      .from(STORES.CARDS)
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
  ])

  if (topicsResult.error) throw topicsResult.error
  if (cardsResult.error) throw cardsResult.error

  const liveTopics = new Set((topicsResult.data ?? []).map(row => row.id))
  const liveCards = new Set((cardsResult.data ?? []).map(row => row.id))

  const pending = new Set((await getQueue()).map(item => item.recordId))
  const [localTopics, localCards] = await Promise.all([
    getAllLocal<Topic>(STORES.TOPICS),
    getAllLocal<Card>(STORES.CARDS)
  ])

  let didMutateLocal = false

  for (const topic of localTopics) {
    if (!liveTopics.has(topic.id) && !pending.has(topic.id)) {
      await deleteLocalTopic(topic.id)
      didMutateLocal = true
    }
  }

  for (const card of localCards) {
    if (!liveCards.has(card.id) && !pending.has(card.id)) {
      await deleteLocalCard(card.id)
      didMutateLocal = true
    }
  }

  if (didMutateLocal) emitSyncData()
}

export async function syncAll(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setState({ status: 'offline' })
    return
  }

  setState({ status: 'syncing' })

  try {
    const deviceId = await getDeviceId()

    const lastSyncAt = await getMeta(LAST_SYNC_AT_KEY)
    if (
      lastSyncAt !== undefined &&
      Date.now() - Number(lastSyncAt) > ACTIVE_WINDOW_MS
    ) {
      await reconcile(userId)
    }

    const otherActive = await countOtherActiveDevices(userId, deviceId)
    await pushChanges(userId, otherActive === 0)
    await pullChanges(userId)
    await reportDevice(userId, deviceId)
    await purgeTombstones()

    await setMeta(LAST_SYNC_AT_KEY, String(Date.now()))
    setState({ status: 'idle', lastSyncedAt: Date.now() })
  } catch (error) {
    console.error('Sync failed:', error)
    setState({ status: 'error' })
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

// --- Public control surface ---

export function setSyncUser(userId: string | null): void {
  currentUserId = userId
  if (!userId) {
    setState({ status: 'idle' })
  }
}

export async function initialSync(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return

  const migratedUserId = await getMeta('migratedUserId')
  if (migratedUserId !== userId) {
    await migrateLocalToCloud()
    await setMeta('migratedUserId', userId)
  }

  await syncAll(userId)
}

export function syncNow(): void {
  if (!currentUserId) return
  void syncAll(currentUserId)
}

export function triggerSync(): void {
  if (!currentUserId || !isSupabaseConfigured) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  if (triggerTimer) clearTimeout(triggerTimer)
  triggerTimer = setTimeout(() => {
    triggerTimer = null
    if (currentUserId) void syncAll(currentUserId)
  }, TRIGGER_DEBOUNCE_MS)
}
