import { isSideEmpty } from '@/lib/check-content'
import { encodeCardData } from '../lib/card-codec'
import { readList, writeList } from '../lib/chrome-store'
import { CARDS_KEY } from '../lib/keys'
import type { Card, CardData } from '../types'
import { dropFor, enqueue } from './outbox.service'

export const getCards = () => readList<Card>(CARDS_KEY)

export async function getCard(id: string): Promise<Card | undefined> {
  return (await getCards()).find(card => card.id === id)
}

function cardLevel(data: CardData) {
  return isSideEmpty(data.front) || isSideEmpty(data.back) ? 0 : 1
}

async function enqueueCard(
  recordId: string,
  operation: 'upsert' | 'delete',
  updatedAt: number
) {
  await enqueue({
    id: crypto.randomUUID(),
    table: 'cards',
    recordId,
    operation,
    updatedAt,
    attempts: 0,
    nextAttemptAt: 0
  })
}

export async function saveCard(
  data: CardData,
  topicId: string,
  enqueueSync = false
): Promise<Card> {
  const card: Card = {
    id: crypto.randomUUID(),
    topicId,
    level: cardLevel(data),
    data: encodeCardData(data),
    updatedAt: Date.now()
  }
  await writeList(CARDS_KEY, [...(await getCards()), card])
  if (enqueueSync) await enqueueCard(card.id, 'upsert', card.updatedAt)
  return card
}

export async function updateCard(
  id: string,
  data: CardData,
  enqueueSync = false
): Promise<Card | undefined> {
  const cards = await getCards()
  const index = cards.findIndex(card => card.id === id)
  const existing = cards[index]
  if (!existing) return undefined
  const card: Card = {
    ...existing,
    level: cardLevel(data),
    data: encodeCardData(data),
    updatedAt: Date.now()
  }
  cards[index] = card
  await writeList(CARDS_KEY, cards)
  if (enqueueSync) await enqueueCard(card.id, 'upsert', card.updatedAt)
  return card
}

export async function deleteCards(
  ids: string[],
  enqueueSync = true
): Promise<void> {
  await writeList(
    CARDS_KEY,
    (await getCards()).filter(card => !ids.includes(card.id))
  )
  if (!enqueueSync) return
  for (const id of ids) {
    if (await dropFor(id)) continue
    await enqueueCard(id, 'delete', Date.now())
  }
}
