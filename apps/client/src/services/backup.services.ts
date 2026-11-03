import { enqueueSync, triggerSync } from './sync.service'
import {
  normalizeCardData,
  parseImportJson,
  promisifyRequest,
  withTransaction,
  STORES
} from '@/lib'
import {
  adjustCardMediaStats,
  addEmbeddedMedia,
  sumEmbeddedCardMedia,
  subEmbeddedMedia,
  type EmbeddedCardMedia
} from '@/lib/card-media-stats'
import { decodeCardData, encodeCardData } from '@/lib/sync-serialize'
import { Card, Topic } from '@/models'
import type { ExportedFile } from '@/types'
import {
  emitStudyData,
  getAllCardsFromMemory,
  getAllTopicsFromMemory,
  getCardFromMemory,
  getTopicFromMemory,
  putCardInMemory,
  putTopicInMemory,
  restoreCardInMemory,
  restoreTopicInMemory
} from './study-memory'

const BACKUP_VERSION = 1
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ensureUuid(id: string): string {
  return UUID_RE.test(id) ? id : crypto.randomUUID()
}

export async function exportAppData(): Promise<ExportedFile> {
  const topics = getAllTopicsFromMemory()
  const cards = getAllCardsFromMemory()

  const processedCards = cards.map(card => ({
    ...card,
    data: encodeCardData(card.data)
  }))

  const exportedAt = new Date().toISOString()
  const payload = {
    version: BACKUP_VERSION,
    exportedAt,
    topics,
    cards: processedCards
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  })

  return {
    blob,
    fileName: `spaced-rep-backup-${exportedAt}.json`
  }
}

function parseBackup(text: string): { topics: Topic[]; cards: Card[] } {
  let data: { topics?: Topic[]; cards?: Card[] }

  try {
    data = parseImportJson(text) as { topics?: Topic[]; cards?: Card[] }
  } catch {
    throw new Error('Invalid JSON in backup file')
  }

  if (!Array.isArray(data.topics) || !Array.isArray(data.cards)) {
    throw new Error('Invalid backup file: missing topics[] or cards[]')
  }

  // Old nanoid IDs are remapped to UUIDs so sync can upsert into Postgres.
  const topicIdMap = new Map<string, string>()
  const topics = data.topics.map(topic => {
    const id = ensureUuid(topic.id)
    if (id !== topic.id) topicIdMap.set(topic.id, id)
    return id === topic.id ? topic : { ...topic, id }
  })

  const cards = data.cards.map(card => ({
    ...card,
    id: ensureUuid(card.id),
    topicId: topicIdMap.get(card.topicId) ?? card.topicId,
    data: normalizeCardData(decodeCardData(card.data))
  }))

  return { topics, cards }
}

// Title has a unique index: a title used by a different local topic id would
// abort the put. Rename on clash so a merge import stays non-destructive.
function renameTitleClashes(topics: Topic[]): void {
  const titleToId = new Map(getAllTopicsFromMemory().map(t => [t.title, t.id]))

  for (const topic of topics) {
    const owner = titleToId.get(topic.title)
    if (owner && owner !== topic.id) {
      topic.title = `${topic.title} (imported ${topic.id.slice(0, 4)})`
    }
    titleToId.set(topic.title, topic.id)
  }
}

export async function importAppData(
  source: File | string
): Promise<{ topics: number; cards: number }> {
  const text = typeof source === 'string' ? source : await source.text()
  const { topics, cards } = parseBackup(text)
  renameTitleClashes(topics)

  const previousTopics = new Map(
    topics.map(topic => [topic.id, getTopicFromMemory(topic.id)])
  )
  const previousCards = new Map(
    cards.map(card => [card.id, getCardFromMemory(card.id)])
  )

  for (const topic of topics) putTopicInMemory(topic)
  for (const card of cards) putCardInMemory(card)
  emitStudyData()

  const importedTopicIds: string[] = []
  const importedCardIds: string[] = []
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
        for (const topic of topics) {
          await promisifyRequest(stores[STORES.TOPICS].put(topic))
          importedTopicIds.push(topic.id)
        }

        for (const card of cards) {
          const previous = previousCards.get(card.id)
          await promisifyRequest(stores[STORES.CARDS].put(card))
          importedCardIds.push(card.id)
          mediaDelta = addEmbeddedMedia(
            mediaDelta,
            subEmbeddedMedia(
              sumEmbeddedCardMedia(card),
              previous
                ? sumEmbeddedCardMedia(previous)
                : { bytes: 0, images: 0, audio: 0 }
            )
          )
        }
      }
    )
  } catch (error) {
    for (const [id, previous] of previousTopics) {
      restoreTopicInMemory(id, previous)
    }
    for (const [id, previous] of previousCards) {
      restoreCardInMemory(id, previous)
    }
    emitStudyData()
    throw error
  }

  await adjustCardMediaStats(mediaDelta)

  for (const id of importedTopicIds) {
    await enqueueSync(STORES.TOPICS, id, 'upsert')
  }
  for (const id of importedCardIds) {
    await enqueueSync(STORES.CARDS, id, 'upsert')
  }
  triggerSync()

  return { topics: importedTopicIds.length, cards: importedCardIds.length }
}
