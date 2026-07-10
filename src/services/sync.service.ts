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

let currentUserId: string | null = null
let state: SyncState = { status: 'idle', lastSyncedAt: null }
let triggerTimer: ReturnType<typeof setTimeout> | null = null

const listeners = new Set<(state: SyncState) => void>()

function setState(next: Partial<SyncState>): void {
  state = { ...state, ...next }
  listeners.forEach(listener => listener(state))
}

export function subscribeSync(listener: (state: SyncState) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSyncState(): SyncState {
  return state
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

// --- Queue ---

export async function enqueueSync(
  table: SyncTable,
  recordId: string,
  operation: SyncOperation
): Promise<void> {
  if (!currentUserId || !isSupabaseConfigured) return

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

async function pushChanges(userId: string): Promise<void> {
  const queue = await getQueue()

  for (const item of queue) {
    if (item.operation === 'delete') {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from(item.table)
        .update({ deleted_at: now, updated_at: now })
        .eq('id', item.recordId)
        .eq('user_id', userId)

      if (error) throw error
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

  for (const row of topicRows) {
    const remoteMs = new Date(row.updated_at).getTime()
    maxUpdatedAt = Math.max(maxUpdatedAt, remoteMs)

    if (row.deleted_at) {
      await deleteLocalTopic(row.id)
      continue
    }

    const local = await getLocalRecord<Topic>(STORES.TOPICS, row.id)
    if (shouldApplyRemote(local?.updatedAt, remoteMs)) {
      await putLocal(STORES.TOPICS, rowToTopic(row))
    }
  }

  for (const row of cardRows) {
    const remoteMs = new Date(row.updated_at).getTime()
    maxUpdatedAt = Math.max(maxUpdatedAt, remoteMs)

    if (row.deleted_at) {
      await deleteLocalCard(row.id)
      continue
    }

    const local = await getLocalRecord<Card>(STORES.CARDS, row.id)
    if (shouldApplyRemote(local?.updatedAt, remoteMs)) {
      await putLocal(STORES.CARDS, rowToCard(row))
    }
  }

  if (topicRows.length > 0 || cardRows.length > 0) {
    await setMeta('lastPulledAt', new Date(maxUpdatedAt).toISOString())
  }
}

export async function syncAll(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setState({ status: 'offline' })
    return
  }

  setState({ status: 'syncing' })

  try {
    await pushChanges(userId)
    await pullChanges(userId)
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
