import { INITIAL_CURSOR, isCursorAhead } from '@spaced-rep/sync-protocol'
import { promisifyRequest } from '@/lib'
import { STORES, withTransaction } from '@/lib/db'
import { setState, type FailedOp } from './sync-state'

export const DEVICE_ID_KEY = 'deviceId'
export const LAST_SYNC_AT_KEY = 'lastSyncAt'
export const CURSOR_KEY = 'lastPulledAt'
const FAILED_OPS_KEY = 'failedOps'
const MAX_FAILED_OPS = 50

interface MetaRow {
  key: string
  value: string
}

export async function getMeta(key: string): Promise<string | undefined> {
  const record = await withTransaction(STORES.SYNC_META, 'readonly', stores =>
    promisifyRequest<MetaRow | undefined>(stores[STORES.SYNC_META].get(key))
  )
  return record?.value
}

export async function setMeta(key: string, value: string): Promise<void> {
  await withTransaction(STORES.SYNC_META, 'readwrite', async stores => {
    await promisifyRequest(stores[STORES.SYNC_META].put({ key, value }))
  })
}

export async function getDeviceId(): Promise<string> {
  let id = await getMeta(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    await setMeta(DEVICE_ID_KEY, id)
  }
  return id
}

/** Where the next pull starts. */
export async function getCursor(): Promise<string> {
  return (await getMeta(CURSOR_KEY)) ?? INITIAL_CURSOR
}

/**
 * Moves the pull cursor forward, never back. Compare and write share one
 * transaction so a slow delta cannot rewind what a faster one already stored,
 * in this tab or another.
 */
export async function advanceCursor(watermark: string): Promise<void> {
  await withTransaction(STORES.SYNC_META, 'readwrite', async stores => {
    const meta = stores[STORES.SYNC_META]
    const current = await promisifyRequest<MetaRow | undefined>(
      meta.get(CURSOR_KEY)
    )
    if (current === undefined || isCursorAhead(watermark, current.value)) {
      await promisifyRequest(meta.put({ key: CURSOR_KEY, value: watermark }))
    }
  })
}

export async function loadFailedOps(): Promise<FailedOp[]> {
  const raw = await getMeta(FAILED_OPS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as FailedOp[]
  } catch {
    return []
  }
}

export async function saveFailedOps(ops: FailedOp[]): Promise<void> {
  const kept = ops.slice(-MAX_FAILED_OPS)
  await setMeta(FAILED_OPS_KEY, JSON.stringify(kept))
  setState({ failedOps: kept })
}

/** Appends entries, replacing any earlier entry with the same opId. */
export async function addFailedOps(entries: FailedOp[]): Promise<void> {
  if (entries.length === 0) return
  const added = new Set(entries.map(entry => entry.opId))
  const existing = await loadFailedOps()
  await saveFailedOps([
    ...existing.filter(entry => !added.has(entry.opId)),
    ...entries
  ])
}
