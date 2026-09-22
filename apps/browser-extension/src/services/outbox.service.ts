import type { SyncOperation, SyncTable } from '@spaced-rep/sync-protocol'
import { readList, writeList } from '../lib/chrome-store'
import { OUTBOX_KEY } from '../lib/keys'

export interface OutboxItem {
  id: string
  table: SyncTable
  recordId: string
  operation: SyncOperation
  updatedAt: number
  attempts: number
  nextAttemptAt: number
}

type LegacyOutboxItem = {
  id: string
  cardId: string
  attempts: number
  nextAttemptAt: number
}

function normalizeOutboxItem(item: OutboxItem | LegacyOutboxItem): OutboxItem {
  if ('recordId' in item) return item
  return {
    id: item.id,
    table: 'cards',
    recordId: item.cardId,
    operation: 'upsert',
    updatedAt: 0,
    attempts: item.attempts,
    nextAttemptAt: item.nextAttemptAt
  }
}

export async function getOutbox(): Promise<OutboxItem[]> {
  const stored = await readList<OutboxItem | LegacyOutboxItem>(OUTBOX_KEY)
  return stored.map(normalizeOutboxItem)
}

export async function enqueue(item: OutboxItem): Promise<void> {
  await writeList(OUTBOX_KEY, [...(await getOutbox()), item])
}

export async function updateOutbox(item: OutboxItem): Promise<void> {
  const items = await getOutbox()
  await writeList(
    OUTBOX_KEY,
    items.some(candidate => candidate.id === item.id)
      ? items.map(candidate => (candidate.id === item.id ? item : candidate))
      : [...items, item]
  )
}

export async function removeOutbox(id: string): Promise<void> {
  await writeList(
    OUTBOX_KEY,
    (await getOutbox()).filter(item => item.id !== id)
  )
}
