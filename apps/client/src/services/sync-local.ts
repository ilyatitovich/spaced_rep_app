import type { PullDelta } from '@spaced-rep/sync-protocol'
import { promisifyRequest } from '@/lib'
import {
  adjustCardMediaStats,
  addEmbeddedMedia,
  recordCardMediaDelete,
  recordCardMediaUpsert,
  sumEmbeddedCardMedia,
  subEmbeddedMedia,
  type EmbeddedCardMedia
} from '@/lib/card-media-stats'
import { STORES, withTransaction } from '@/lib/db'
import type { Card, Topic } from '@/models'
import {
  deleteCardFromMemory,
  deleteTopicFromMemory,
  getCardsByTopicFromMemory,
  putCardInMemory,
  putTopicInMemory,
  restoreCardInMemory,
  restoreTopicInMemory
} from './study-memory'
import type { SyncTable } from './sync-state'

/**
 * The durable copy of a record. Memory is only this tab's cache: another tab
 * may have written a newer row since, so anything that decides whether to push
 * or overwrite must read IndexedDB.
 */
export async function readDurableRecord<T extends Topic | Card>(
  table: SyncTable,
  id: string
): Promise<T | undefined> {
  return withTransaction(table, 'readonly', stores =>
    promisifyRequest<T | undefined>(stores[table].get(id))
  )
}

/** Durable copies of every record a delta touches, read in one transaction. */
export async function readDurableRows(
  delta: PullDelta
): Promise<{ topics: Map<string, Topic>; cards: Map<string, Card> }> {
  const topicIds = delta.records.flatMap(r => (r.topic ? [r.topic.id] : []))
  const cardIds = delta.records.flatMap(r => (r.card ? [r.card.id] : []))
  const topics = new Map<string, Topic>()
  const cards = new Map<string, Card>()
  if (topicIds.length === 0 && cardIds.length === 0) return { topics, cards }

  await withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readonly',
    async stores => {
      for (const id of topicIds) {
        const row = await promisifyRequest<Topic | undefined>(
          stores[STORES.TOPICS].get(id)
        )
        if (row) topics.set(id, row)
      }
      for (const id of cardIds) {
        const row = await promisifyRequest<Card | undefined>(
          stores[STORES.CARDS].get(id)
        )
        if (row) cards.set(id, row)
      }
    }
  )
  return { topics, cards }
}

// The apply helpers below update memory, then IndexedDB, and roll memory back on
// failure. They do not emit: the caller (applyPullDelta) emits once per batch.
export async function putLocal(
  table: SyncTable,
  value: Topic | Card
): Promise<void> {
  if (table === STORES.CARDS) {
    const card = value as Card
    const previous = putCardInMemory(card)
    try {
      await withTransaction(table, 'readwrite', async stores => {
        await promisifyRequest(stores[table].put(card))
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
      await promisifyRequest(stores[table].put(topic))
    })
  } catch (error) {
    restoreTopicInMemory(topic.id, previous)
    throw error
  }
}

export async function deleteLocalTopic(topicId: string): Promise<void> {
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
        await promisifyRequest(stores[STORES.TOPICS].delete(topicId))

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

export async function deleteLocalCard(cardId: string): Promise<void> {
  const previous = deleteCardFromMemory(cardId)
  try {
    await withTransaction(STORES.CARDS, 'readwrite', async stores => {
      await promisifyRequest(stores[STORES.CARDS].delete(cardId))
    })
  } catch (error) {
    restoreCardInMemory(cardId, previous)
    throw error
  }
  if (previous) await recordCardMediaDelete(previous)
}
