import { enqueueSync, triggerSync } from './sync.service'
import {
  withTransaction,
  STORES,
  CARDS_TOPIC_LEVEL_INDEX,
  LEVELS
} from '@/lib'
import {
  adjustCardMediaStats,
  addEmbeddedMedia,
  sumEmbeddedCardMedia,
  subEmbeddedMedia,
  type EmbeddedCardMedia
} from '@/lib/card-media-stats'
import { encodeCardData } from '@/lib/sync-serialize'
import { Topic, Card, updateWeek } from '@/models'

export async function createTopic(topic: Topic): Promise<void> {
  try {
    await withTransaction(STORES.TOPICS, 'readwrite', async stores => {
      await new Promise((resolve, reject) => {
        const request = stores[STORES.TOPICS].add(topic)
        request.onsuccess = () => resolve(undefined)
        request.onerror = () => reject(request.error)
      })
    })
    await enqueueSync(STORES.TOPICS, topic.id, 'upsert')
    triggerSync()
  } catch (error) {
    if ((error as Error).name === 'ConstraintError') {
      throw new Error(
        `A topic with the title "${topic.title}" already exists. Topic title must be unique.`
      )
    }
    console.error('Failed to save topic:', error)
    throw error
  }
}

export async function getAllTopics(): Promise<Topic[]> {
  const topics = await withTransaction(
    STORES.TOPICS,
    'readonly',
    async stores => {
      return new Promise<Topic[]>((resolve, reject) => {
        const request = stores[STORES.TOPICS].getAll()

        request.onsuccess = () => {
          resolve(request.result as Topic[])
        }

        request.onerror = () => {
          reject(request.error ?? new Error('Failed to fetch topics'))
        }
      })
    }
  )

  const updated: Topic[] = []

  for (const topic of topics) {
    if (topic.nextUpdateDate <= Date.now()) {
      updateWeek(topic)
      updated.push(topic)
    }
  }

  if (updated.length > 0) {
    await updateTopics(updated)
  }

  return topics.sort((a, b) => b.pivot - a.pivot)
}

export async function getTopicById(
  topicId: string
): Promise<{ topic: Topic; levelCounts: Record<number, number> }> {
  return withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readonly',
    async stores => {
      const topicStore = stores[STORES.TOPICS]
      const cardStore = stores[STORES.CARDS]

      const topicRequest = topicStore.get(topicId)

      const topic = await new Promise<Topic | undefined>((resolve, reject) => {
        topicRequest.onsuccess = () => resolve(topicRequest.result)
        topicRequest.onerror = () =>
          reject(topicRequest.error ?? new Error('Failed to fetch topic'))
      })

      if (!topic) {
        throw new Error(`Topic with ID ${topicId} not found`)
      }

      const levelIndex = cardStore.index(CARDS_TOPIC_LEVEL_INDEX)
      const levelCounts: Record<number, number> = {}

      await Promise.all(
        LEVELS.map(
          level =>
            new Promise<void>((resolve, reject) => {
              const req = levelIndex.count(
                IDBKeyRange.only([topicId, level])
              )
              req.onsuccess = () => {
                levelCounts[level] = req.result
                resolve()
              }
              req.onerror = () =>
                reject(
                  req.error ?? new Error(`Failed to count cards at level ${level}`)
                )
            })
        )
      )

      return { topic, levelCounts }
    }
  )
}

export async function deleteTopic(topicId: string): Promise<void> {
  const { deletedCardIds, mediaDelta } = await withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readwrite',
    async stores => {
      const topicStore = stores[STORES.TOPICS]
      const cardStore = stores[STORES.CARDS]

      await new Promise<void>((resolve, reject) => {
        const request = topicStore.delete(topicId)
        request.onsuccess = () => resolve()
        request.onerror = () =>
          reject(request.error ?? new Error('Failed to delete topic'))
      })

      const index = cardStore.index('topicId')
      const range = IDBKeyRange.only(topicId)
      const cardIds: string[] = []
      let mediaDelta: EmbeddedCardMedia = {
        bytes: 0,
        images: 0,
        audio: 0
      }

      return new Promise<{
        deletedCardIds: string[]
        mediaDelta: EmbeddedCardMedia
      }>((resolve, reject) => {
        const request = index.openCursor(range)

        request.onsuccess = () => {
          const cursor = request.result
          if (cursor) {
            const card = cursor.value as Card
            cardIds.push(card.id)
            mediaDelta = addEmbeddedMedia(
              mediaDelta,
              subEmbeddedMedia(
                { bytes: 0, images: 0, audio: 0 },
                sumEmbeddedCardMedia(card)
              )
            )
            cursor.delete()
            cursor.continue()
          } else {
            resolve({ deletedCardIds: cardIds, mediaDelta })
          }
        }

        request.onerror = () =>
          reject(request.error ?? new Error('Failed to delete topic cards'))
      })
    }
  )

  await adjustCardMediaStats(mediaDelta)
  await enqueueSync(STORES.TOPICS, topicId, 'delete')
  for (const cardId of deletedCardIds) {
    await enqueueSync(STORES.CARDS, cardId, 'delete')
  }
  triggerSync()
}

export async function updateTopic(topic: Topic): Promise<void> {
  topic.updatedAt = Date.now()

  await withTransaction([STORES.TOPICS], 'readwrite', async stores => {
    const store = stores[STORES.TOPICS]

    await new Promise<void>((resolve, reject) => {
      const request = store.put(topic)
      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(request.error ?? new Error('Failed to update topic'))
    })
  })

  await enqueueSync(STORES.TOPICS, topic.id, 'upsert')
  triggerSync()
}

export async function updateTopics(topics: Topic[]): Promise<void> {
  topics.forEach(topic => {
    topic.updatedAt = Date.now()
  })

  await withTransaction([STORES.TOPICS], 'readwrite', async stores => {
    const store = stores[STORES.TOPICS]

    await Promise.all(
      topics.map(
        topic =>
          new Promise<void>((resolve, reject) => {
            const request = store.put(topic)
            request.onsuccess = () => resolve()
            request.onerror = () =>
              reject(request.error ?? new Error('Failed to update topic'))
          })
      )
    )
  })

  for (const topic of topics) {
    await enqueueSync(STORES.TOPICS, topic.id, 'upsert')
  }
  triggerSync()
}

export async function exportTopic(
  topicId: string
): Promise<Record<string, string>> {
  return withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readonly',
    async stores => {
      const topicStore = stores[STORES.TOPICS]
      const cardStore = stores[STORES.CARDS]

      const topicRequest = topicStore.get(topicId)

      const topic = await new Promise<Topic | undefined>((resolve, reject) => {
        topicRequest.onsuccess = () => resolve(topicRequest.result)
        topicRequest.onerror = () =>
          reject(topicRequest.error ?? new Error('Failed to fetch topic'))
      })

      if (!topic) {
        throw new Error(`Topic with ID ${topicId} not found`)
      }

      const cardsIndex = cardStore.index('topicId')
      const cardsRequest = cardsIndex.getAll(IDBKeyRange.only(topicId))

      const cards = await new Promise<Card[]>((resolve, reject) => {
        cardsRequest.onsuccess = () => resolve(cardsRequest.result)
        cardsRequest.onerror = () =>
          reject(cardsRequest.error ?? new Error('Failed to fetch cards'))
      })

      const processedCards = cards.map((card: Card) => ({
        ...card,
        data: encodeCardData(card.data)
      }))

      const payload = {
        exportedAt: new Date().toISOString(),
        topic: {
          id: topic.id,
          title: topic.title,
          pivot: topic.pivot
        },
        cards: processedCards
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json'
      })

      const url = URL.createObjectURL(blob)

      return {
        fileUrl: url,
        fileName: `topic-${topic.title}-${topic.id}-${payload.exportedAt}.json`
      }
    }
  )
}
