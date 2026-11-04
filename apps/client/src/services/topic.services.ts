import {
  putSyncQueueOps,
  refreshSyncQueueDepth,
  triggerSync
} from './sync.service'
import {
  withTransaction,
  STORES,
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
import {
  deleteCardFromMemory,
  deleteTopicFromMemory,
  emitStudyData,
  findTopicByTitle,
  getAllTopicsFromMemory,
  getCardsByTopicFromMemory,
  getTopicFromMemory,
  putCardInMemory,
  putTopicInMemory,
  restoreTopicInMemory
} from './study-memory'

const DELETE_CHUNK = 50

function duplicateTitleError(title: string): Error {
  return new Error(
    `A topic with the title "${title}" already exists. Topic title must be unique.`
  )
}

export async function createTopic(topic: Topic): Promise<void> {
  if (findTopicByTitle(topic.title)) {
    throw duplicateTitleError(topic.title)
  }

  const previous = putTopicInMemory(topic)
  emitStudyData()
  try {
    // Row + outbox op in one transaction: never an edit that cannot sync.
    await withTransaction(
      [STORES.TOPICS, STORES.SYNC_QUEUE],
      'readwrite',
      async stores => {
        await promisifyRequest(stores[STORES.TOPICS].add(topic))
        await putSyncQueueOps(stores[STORES.SYNC_QUEUE], [
          { table: STORES.TOPICS, recordId: topic.id, operation: 'upsert' }
        ])
      }
    )
  } catch (error) {
    restoreTopicInMemory(topic.id, previous)
    emitStudyData()
    if ((error as Error).name === 'ConstraintError') {
      throw duplicateTitleError(topic.title)
    }
    console.error('Failed to save topic:', error)
    throw error
  }

  await refreshSyncQueueDepth()
  triggerSync()
}

export async function getAllTopics(): Promise<Topic[]> {
  const topics = getAllTopicsFromMemory()
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
  const topic = getTopicFromMemory(topicId)
  if (!topic) {
    throw new Error(`Topic with ID ${topicId} not found`)
  }

  const levelCounts: Record<number, number> = Object.fromEntries(
    LEVELS.map(level => [level, 0])
  )
  for (const card of getCardsByTopicFromMemory(topicId)) {
    if (card.level in levelCounts) {
      levelCounts[card.level] = (levelCounts[card.level] ?? 0) + 1
    }
  }

  return { topic, levelCounts }
}

export async function deleteTopic(topicId: string): Promise<void> {
  const previousCards = getCardsByTopicFromMemory(topicId)
  const previousTopic = deleteTopicFromMemory(topicId)
  for (const card of previousCards) deleteCardFromMemory(card.id)
  emitStudyData()

  let mediaDelta: EmbeddedCardMedia = {
    bytes: 0,
    images: 0,
    audio: 0
  }

  try {
    for (let i = 0; i < previousCards.length; i += DELETE_CHUNK) {
      const slice = previousCards.slice(i, i + DELETE_CHUNK)

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
      if (i + DELETE_CHUNK < previousCards.length) await yieldToMain()
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
  } catch (error) {
    restoreTopicInMemory(topicId, previousTopic)
    for (const card of previousCards) putCardInMemory(card)
    emitStudyData()
    throw error
  }

  await adjustCardMediaStats(mediaDelta)
  await refreshSyncQueueDepth()
  triggerSync()
}

async function persistTopics(topics: Topic[]): Promise<void> {
  const now = Date.now()
  for (const topic of topics) {
    const clash = findTopicByTitle(topic.title)
    if (clash && clash.id !== topic.id) {
      throw duplicateTitleError(topic.title)
    }
  }
  const previous = topics.map(topic => {
    topic.updatedAt = now
    return { id: topic.id, previous: putTopicInMemory(topic) }
  })
  emitStudyData()

  try {
    await withTransaction(
      [STORES.TOPICS, STORES.SYNC_QUEUE],
      'readwrite',
      async stores => {
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
        await putSyncQueueOps(
          stores[STORES.SYNC_QUEUE],
          topics.map(topic => ({
            table: STORES.TOPICS,
            recordId: topic.id,
            operation: 'upsert' as const
          }))
        )
      }
    )
  } catch (error) {
    for (const entry of previous) {
      restoreTopicInMemory(entry.id, entry.previous)
    }
    emitStudyData()
    if ((error as Error).name === 'ConstraintError') {
      const title = topics[0]?.title ?? ''
      throw duplicateTitleError(title)
    }
    throw error
  }

  await refreshSyncQueueDepth()
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
  const topic = getTopicFromMemory(topicId)
  if (!topic) {
    throw new Error(`Topic with ID ${topicId} not found`)
  }

  const cards = getCardsByTopicFromMemory(topicId)
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
