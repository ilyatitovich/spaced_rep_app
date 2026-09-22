import { isSideEmpty } from '@/lib/check-content'
import { encodeCardData } from '../lib/card-codec'
import { readList, writeList } from '../lib/chrome-store'
import { CARDS_KEY } from '../lib/keys'
import type { Card, CardData } from '../types'
import { enqueue } from './outbox.service'

export const getCards = () => readList<Card>(CARDS_KEY)

export async function getCard(id: string): Promise<Card | undefined> {
  return (await getCards()).find(card => card.id === id)
}

export async function saveCard(
  data: CardData,
  topicId: string,
  enqueueSync = false
): Promise<Card> {
  const card: Card = {
    id: crypto.randomUUID(),
    topicId,
    level: isSideEmpty(data.front) || isSideEmpty(data.back) ? 0 : 1,
    data: encodeCardData(data),
    updatedAt: Date.now()
  }
  await writeList(CARDS_KEY, [...(await getCards()), card])
  if (enqueueSync) {
    await enqueue({
      id: crypto.randomUUID(),
      cardId: card.id,
      attempts: 0,
      nextAttemptAt: 0
    })
  }
  return card
}
