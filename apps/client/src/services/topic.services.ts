import {
  enqueueSync,
  putSyncQueueOps,
  refreshSyncQueueDepth,
  triggerSync
} from './sync.service'
import {
  withTransaction,
  STORES,
  CARDS_TOPIC_LEVEL_INDEX,
  LEVELS,
  shareFile,
  promisifyRequest,
  yieldToMain
} from '@/lib'
import {
  adjustCardMediaStats,
  addEmbeddedMedia,
  sumEmbeddedCardMedia,
  subEmbeddedMedia,
  type EmbeddedCardMedia
} from '@/lib/card-media-stats'
import { encodeCardData } from '@/lib/sync-serialize'
import { Topic, Card, updateWeek, reactivateTopic } from '@/models'
import type { ExportedFile } from '@/types'

const DELETE_CHUNK = 50

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
    if (!topic.isArchived && topic.nextUpdateDate <= Date.now()) {
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
              const req = levelIndex.count(IDBKeyRange.only([topicId, level]))
              req.onsuccess = () => {
                levelCounts[level] = req.result
                resolve()
              }
              req.onerror = () =>
                reject(
                  req.error ??
                    new Error(`Failed to count cards at level ${level}`)
                )
            })
        )
      )

      return { topic, levelCounts }
    }
  )
}

export async function deleteTopic(topicId: string): Promise<void> {
  const cards = await withTransaction(
    STORES.CARDS,
    'readonly',
    async stores => {
      const index = stores[STORES.CARDS].index('topicId')
      return promisifyRequest<Card[]>(
        index.getAll(IDBKeyRange.only(topicId)) as IDBRequest<Card[]>
      )
    }
  )

  let mediaDelta: EmbeddedCardMedia = {
    bytes: 0,
    images: 0,
    audio: 0
  }

  for (let i = 0; i < cards.length; i += DELETE_CHUNK) {
    const slice = cards.slice(i, i + DELETE_CHUNK)

    const chunkDelta = await withTransaction(
      [STORES.CARDS, STORES.SYNC_QUEUE],
      'readwrite',
      async stores => {
        let delta: EmbeddedCardMedia = {
          bytes: 0,
          images: 0,
          audio: 0
        }
        const deletedIds: string[] = []

        for (const card of slice) {
          await promisifyRequest(stores[STORES.CARDS].delete(card.id))
          deletedIds.push(card.id)
          delta = addEmbeddedMedia(
            delta,
            subEmbeddedMedia(
              { bytes: 0, images: 0, audio: 0 },
              sumEmbeddedCardMedia(card)
            )
          )
        }

        await putSyncQueueOps(
          stores[STORES.SYNC_QUEUE],
          deletedIds.map(recordId => ({
            table: STORES.CARDS,
            recordId,
            operation: 'delete' as const
          }))
        )

        return delta
      }
    )

    mediaDelta = addEmbeddedMedia(mediaDelta, chunkDelta)
    if (i + DELETE_CHUNK < cards.length) await yieldToMain()
  }

  await withTransaction(
    [STORES.TOPICS, STORES.SYNC_QUEUE],
    'readwrite',
    async stores => {
      await promisifyRequest(stores[STORES.TOPICS].delete(topicId))
      await putSyncQueueOps(stores[STORES.SYNC_QUEUE], [
        {
          table: STORES.TOPICS,
          recordId: topicId,
          operation: 'delete'
        }
      ])
    }
  )

  await adjustCardMediaStats(mediaDelta)
  await refreshSyncQueueDepth()
  triggerSync()
}

async function persistTopics(topics: Topic[]): Promise<void> {
  const now = Date.now()
  topics.forEach(topic => {
    topic.updatedAt = now
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

export function updateTopic(topic: Topic): Promise<void> {
  return persistTopics([topic])
}

export function updateTopics(topics: Topic[]): Promise<void> {
  return persistTopics(topics)
}

export function archiveTopics(topics: Topic[]): Promise<void> {
  topics.forEach(topic => {
    topic.isArchived = true
  })

  return persistTopics(topics)
}

export function unarchiveTopics(topics: Topic[]): Promise<void> {
  topics.forEach(reactivateTopic)

  return persistTopics(topics)
}

export async function exportTopic(topicId: string): Promise<ExportedFile> {
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

      return {
        blob,
        fileName: `topic-${topic.title}-${topic.id}-${payload.exportedAt}.json`
      }
    }
  )
}

export async function shareTopic(topic: Topic): Promise<void> {
  try {
    const { blob, fileName } = await exportTopic(topic.id)
    const file = new File([blob], fileName, { type: 'application/json' })
    await shareFile(file, topic.title)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    throw error
  }
}
