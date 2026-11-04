import { promisifyRequest } from '@/lib'
import { STORES, withTransaction } from '@/lib/db'
import { isBackendConfigured } from '@/providers'
import { setState, type SyncOperation, type SyncTable } from './sync-state'

export interface QueueItem {
  id: string
  opId: string
  table: SyncTable
  recordId: string
  operation: SyncOperation
  createdAt: number
  attempts: number
  nextRetryAt: number
}

export interface SyncEnqueueOp {
  table: SyncTable
  recordId: string
  operation: SyncOperation
}

/** In-flight push opIds — collapsing those upserts would lose the follow-up delete. */
export const inFlightOpIds = new Set<string>()

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

export function backoffMs(attempts: number): number {
  return Math.min(300_000, 1000 * 2 ** attempts) + Math.random() * 1000
}

async function coalesceAndPutQueueItem(
  queueStore: IDBObjectStore,
  table: SyncTable,
  recordId: string,
  operation: SyncOperation
): Promise<void> {
  const queueId = `${table}:${recordId}`
  const existing = await promisifyRequest<QueueItem | undefined>(
    queueStore.get(queueId)
  )

  const next = coalesceQueuedOperation(
    existing?.operation,
    operation,
    existing != null && inFlightOpIds.has(existing.opId)
  )

  if (next === null) {
    if (existing) await promisifyRequest(queueStore.delete(queueId))
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

  await promisifyRequest(
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

/**
 * Write queue ops into an open IDBObjectStore. Callers pass the store of the
 * transaction that writes the record itself, so the row and its op commit or
 * abort together.
 */
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

export async function getQueue(): Promise<QueueItem[]> {
  const items = await withTransaction(STORES.SYNC_QUEUE, 'readonly', stores =>
    promisifyRequest<QueueItem[]>(stores[STORES.SYNC_QUEUE].getAll())
  )
  return items.sort((a, b) => a.createdAt - b.createdAt)
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
  await enqueueSyncBulk([{ table, recordId, operation }])
}

export async function enqueueSyncBulk(ops: SyncEnqueueOp[]): Promise<void> {
  if (!isBackendConfigured() || ops.length === 0) return

  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    await putSyncQueueOps(stores[STORES.SYNC_QUEUE], ops)
  })

  await refreshSyncQueueDepth()
}

export async function removeQueueItem(id: string): Promise<void> {
  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    await promisifyRequest(stores[STORES.SYNC_QUEUE].delete(id))
  })
}

/** Remove only if the row still carries `opId` — a newer edit/delete may have replaced it mid-push. */
export async function removeQueueItemIfOp(item: QueueItem): Promise<void> {
  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    const store = stores[STORES.SYNC_QUEUE]
    const current = await promisifyRequest<QueueItem | undefined>(
      store.get(item.id)
    )
    if (current?.opId === item.opId)
      await promisifyRequest(store.delete(item.id))
  })
}

export async function bumpQueueAttempts(item: QueueItem): Promise<void> {
  const next: QueueItem = {
    ...item,
    attempts: item.attempts + 1,
    nextRetryAt: Date.now() + backoffMs(item.attempts + 1)
  }
  await withTransaction(STORES.SYNC_QUEUE, 'readwrite', async stores => {
    const store = stores[STORES.SYNC_QUEUE]
    const current = await promisifyRequest<QueueItem | undefined>(
      store.get(item.id)
    )
    if (current?.opId !== item.opId) return // replaced mid-push
    await promisifyRequest(store.put(next))
  })
}
