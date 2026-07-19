import { enqueueSync, triggerSync } from './sync.service'
import {
  withTransaction,
  STORES,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  isRecord,
  isBase64Image
} from '@/lib'
import { Card, Topic } from '@/models'
import type { CardSideData, ImageBase64Record } from '@/types'

const BACKUP_VERSION = 1
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ensureUuid(id: string): string {
  return UUID_RE.test(id) ? id : crypto.randomUUID()
}

function encodeSide(side: CardSideData): CardSideData {
  return isRecord(side.content)
    ? { ...side, content: arrayBufferToBase64(side.content) as never }
    : side
}

function decodeSide(side: CardSideData): CardSideData {
  return isBase64Image(side.content)
    ? {
        ...side,
        content: base64ToArrayBuffer(
          side.content as unknown as ImageBase64Record
        )
      }
    : side
}

export async function exportAppData(): Promise<Record<string, string>> {
  return withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readonly',
    async stores => {
      const topics = await new Promise<Topic[]>((resolve, reject) => {
        const request = stores[STORES.TOPICS].getAll()
        request.onsuccess = () => resolve(request.result as Topic[])
        request.onerror = () =>
          reject(request.error ?? new Error('Failed to fetch topics'))
      })

      const cards = await new Promise<Card[]>((resolve, reject) => {
        const request = stores[STORES.CARDS].getAll()
        request.onsuccess = () => resolve(request.result as Card[])
        request.onerror = () =>
          reject(request.error ?? new Error('Failed to fetch cards'))
      })

      const processedCards = cards.map(card => ({
        ...card,
        data: {
          front: encodeSide(card.data.front),
          back: encodeSide(card.data.back)
        }
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
        fileUrl: URL.createObjectURL(blob),
        fileName: `spaced-rep-backup-${exportedAt}.json`
      }
    }
  )
}

export async function importAppData(
  file: File
): Promise<{ topics: number; cards: number }> {
  const text = await file.text()
  let data

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON in backup file')
  }

  if (!Array.isArray(data.topics) || !Array.isArray(data.cards)) {
    throw new Error('Invalid backup file: missing topics[] or cards[]')
  }

  // Old nanoid IDs fail Supabase uuid columns — remapped here so sync can upsert.
  const topicIdMap = new Map<string, string>()
  const topics = (data.topics as Topic[]).map(topic => {
    const id = ensureUuid(topic.id)
    if (id !== topic.id) topicIdMap.set(topic.id, id)
    return id === topic.id ? topic : { ...topic, id }
  })

  const cards = (data.cards as Card[]).map(card => ({
    ...card,
    id: ensureUuid(card.id),
    topicId: topicIdMap.get(card.topicId) ?? card.topicId,
    data: {
      front: decodeSide(card.data.front),
      back: decodeSide(card.data.back)
    }
  }))

  const importedTopicIds: string[] = []
  const importedCardIds: string[] = []

  await withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readwrite',
    async stores => {
      // Title has a unique index: a title used by a different local topic id
      // would abort the put. Pre-read local titles and rename on clash so a
      // merge import stays non-destructive.
      const existing = await new Promise<Topic[]>((resolve, reject) => {
        const request = stores[STORES.TOPICS].getAll()
        request.onsuccess = () => resolve(request.result as Topic[])
        request.onerror = () =>
          reject(request.error ?? new Error('Failed to read topics'))
      })

      const titleToId = new Map(existing.map(t => [t.title, t.id]))

      const putRequest = (store: IDBObjectStore, value: unknown) =>
        new Promise<void>((resolve, reject) => {
          const req = store.put(value)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        })

      for (const topic of topics) {
        const owner = titleToId.get(topic.title)
        if (owner && owner !== topic.id) {
          topic.title = `${topic.title} (imported ${topic.id.slice(0, 4)})`
        }
        titleToId.set(topic.title, topic.id)
        await putRequest(stores[STORES.TOPICS], topic)
        importedTopicIds.push(topic.id)
      }

      for (const card of cards) {
        await putRequest(stores[STORES.CARDS], card)
        importedCardIds.push(card.id)
      }
    }
  )

  for (const id of importedTopicIds) {
    await enqueueSync(STORES.TOPICS, id, 'upsert')
  }
  for (const id of importedCardIds) {
    await enqueueSync(STORES.CARDS, id, 'upsert')
  }
  triggerSync()

  return { topics: importedTopicIds.length, cards: importedCardIds.length }
}
