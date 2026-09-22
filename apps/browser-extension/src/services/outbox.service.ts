import { readList, writeList } from '../lib/chrome-store'
import { OUTBOX_KEY } from '../lib/keys'

export type OutboxItem = {
  id: string
  cardId: string
  attempts: number
  nextAttemptAt: number
}

export const getOutbox = () => readList<OutboxItem>(OUTBOX_KEY)

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
