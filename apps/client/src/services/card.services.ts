import { promisifyRequest, yieldToMain } from '@/lib'
import {
  putSyncQueueOps,
  refreshSyncQueueDepth,
  triggerSync
} from './sync.service'
import {
  recordCardMediaDelete,
  recordCardMediaUpsert,
  sumEmbeddedCardMedia,
  subEmbeddedMedia,
  addEmbeddedMedia,
  adjustCardMediaStats,
  type EmbeddedCardMedia
} from '@/lib/card-media-stats'
import { withTransaction, STORES } from '@/lib/db'
import { normalizeCardData } from '@/lib/normalize-card'
import { parseImportJson } from '@/lib/parse-import-json'
import { getJsonFile, shareFile } from '@/lib/share'
import { decodeCardData } from '@/lib/sync-serialize'
import { Card } from '@/models'
import { getTopicById } from './topic.services'
import {
  deleteCardFromMemory,
  emitStudyData,
  getAllCardsFromMemory,
  getCardFromMemory,
  getCardsByTopicAndLevelFromMemory,
  putCardInMemory,
  restoreCardInMemory
} from './study-memory'

const IMPORT_CHUNK = 50
const NO_MEDIA: EmbeddedCardMedia = { bytes: 0, images: 0, audio: 0 }

function getCardsByIds(cardIds: string[]): Card[] {
  return cardIds
    .map(id => getCardFromMemory(id))
    .filter((card): card is Card => card !== undefined)
}

export async function getCardsByTopicAndLevel(
  topicId: string,
  level: number
): Promise<Card[]> {
  return getCardsByTopicAndLevelFromMemory(topicId, level).map(card => ({
    ...card,
    data: normalizeCardData(card.data)
  }))
}

export async function createCard(card: Card): Promise<void> {
  const previous = putCardInMemory(card)
  emitStudyData()
  try {
    // Row + outbox op in one transaction: never an edit that cannot sync.
    await withTransaction(
      [STORES.CARDS, STORES.SYNC_QUEUE],
      'readwrite',
      async stores => {
        await promisifyRequest(stores[STORES.CARDS].add(card))
        await putSyncQueueOps(stores[STORES.SYNC_QUEUE], [
          { table: STORES.CARDS, recordId: card.id, operation: 'upsert' }
        ])
      }
    )
  } catch (error) {
    restoreCardInMemory(card.id, previous)
    emitStudyData()
    console.error('Failed to save card:', error)
    throw error
  }

  await recordCardMediaUpsert(undefined, card)
  await refreshSyncQueueDepth()
  triggerSync()
}

export async function updateCard(card: Card): Promise<void> {
  try {
    card.updatedAt = Date.now()
    const previous = putCardInMemory(card)
    emitStudyData()
    try {
      await withTransaction(
        [STORES.CARDS, STORES.SYNC_QUEUE],
        'readwrite',
        async stores => {
          await promisifyRequest(stores[STORES.CARDS].put(card))
          await putSyncQueueOps(stores[STORES.SYNC_QUEUE], [
            { table: STORES.CARDS, recordId: card.id, operation: 'upsert' }
          ])
        }
      )
    } catch (error) {
      restoreCardInMemory(card.id, previous)
      emitStudyData()
      throw error
    }
    await recordCardMediaUpsert(previous, card)
    await refreshSyncQueueDepth()
    triggerSync()
  } catch (error) {
    console.error('Failed to update card:', error)
    throw error
  }
}

export async function deleteCardById(cardId: string): Promise<void> {
  const previous = deleteCardFromMemory(cardId)
  emitStudyData()
  try {
    // Local delete + queue op in one transaction: never a row without its op (or vice versa).
    await withTransaction(
      [STORES.CARDS, STORES.SYNC_QUEUE],
      'readwrite',
      async stores => {
        await promisifyRequest(stores[STORES.CARDS].delete(cardId))
        await putSyncQueueOps(stores[STORES.SYNC_QUEUE], [
          { table: STORES.CARDS, recordId: cardId, operation: 'delete' }
        ])
      }
    )
  } catch (error) {
    restoreCardInMemory(cardId, previous)
    emitStudyData()
    throw error
  }

  if (previous) await recordCardMediaDelete(previous)
  await refreshSyncQueueDepth()
  triggerSync()
}

/** Deletes one chunk (rows + queue ops in one transaction). Returns the media freed. */
async function deleteCardsChunk(
  ids: string[],
  previousById: Map<string, Card | undefined>
): Promise<EmbeddedCardMedia> {
  return withTransaction(
    [STORES.CARDS, STORES.SYNC_QUEUE],
    'readwrite',
    async stores => {
      let delta = NO_MEDIA
      const deletedIds: string[] = []

      for (const id of ids) {
        await promisifyRequest(stores[STORES.CARDS].delete(id))
        const card = previousById.get(id)
        if (!card) continue
        deletedIds.push(id)
        delta = addEmbeddedMedia(
          delta,
          subEmbeddedMedia(NO_MEDIA, sumEmbeddedCardMedia(card))
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
}

export async function deleteCardsBulk(cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return

  const previousById = new Map<string, Card | undefined>()
  for (const id of cardIds) {
    previousById.set(id, deleteCardFromMemory(id))
  }
  emitStudyData()

  let mediaDelta = NO_MEDIA

  try {
    for (let i = 0; i < cardIds.length; i += IMPORT_CHUNK) {
      const slice = cardIds.slice(i, i + IMPORT_CHUNK)
      const chunkDelta = await deleteCardsChunk(slice, previousById)
      mediaDelta = addEmbeddedMedia(mediaDelta, chunkDelta)
      if (i + IMPORT_CHUNK < cardIds.length) await yieldToMain()
    }
  } catch (error) {
    for (const [id, previous] of previousById) {
      restoreCardInMemory(id, previous)
    }
    emitStudyData()
    throw error
  }

  await adjustCardMediaStats(mediaDelta)
  await refreshSyncQueueDepth()
  triggerSync()
}

/**
 * Puts every card in one transaction; rejects on the first failed write. With
 * `enqueue`, the upsert ops commit in the same transaction as the rows.
 */
function putAllCards(cards: Card[], enqueue = false): Promise<void> {
  return withTransaction(
    [STORES.CARDS, STORES.SYNC_QUEUE],
    'readwrite',
    async stores => {
      for (const card of cards) {
        await promisifyRequest(stores[STORES.CARDS].put(card))
      }
      if (!enqueue) return
      await putSyncQueueOps(
        stores[STORES.SYNC_QUEUE],
        cards.map(card => ({
          table: STORES.CARDS,
          recordId: card.id,
          operation: 'upsert' as const
        }))
      )
    }
  )
}

export async function updateCardsLevelBulk(
  cards: Card[],
  level: number
): Promise<void> {
  if (cards.length === 0) return

  const now = Date.now()
  const previous = cards.map(card => {
    card.level = level
    card.updatedAt = now
    return { id: card.id, previous: putCardInMemory(card) }
  })
  emitStudyData()

  try {
    await putAllCards(cards, true)
  } catch (error) {
    for (const entry of previous) {
      restoreCardInMemory(entry.id, entry.previous)
    }
    emitStudyData()
    throw error
  }

  await refreshSyncQueueDepth()
  triggerSync()
}

function toNewSchema(card: Card): Card {
  return {
    ...card,
    updatedAt: Date.now(),
    data: normalizeCardData({
      front: {
        type: 'text',
        side: 'front',
        content:
          typeof card.data.front === 'string'
            ? card.data.front
            : ((card.data.front as { content?: unknown })?.content ?? '')
      },
      back: {
        type: 'text',
        side: 'back',
        content:
          typeof card.data.back === 'string'
            ? card.data.back
            : ((card.data.back as { content?: unknown })?.content ?? '')
      }
    })
  }
}

export async function migrateCardsToNewSchema(): Promise<void> {
  const updated = getAllCardsFromMemory().map(toNewSchema)
  if (updated.length === 0) return

  const previous = updated.map(card => ({
    id: card.id,
    previous: putCardInMemory(card)
  }))
  emitStudyData()

  try {
    await putAllCards(updated)
  } catch (error) {
    for (const entry of previous) {
      restoreCardInMemory(entry.id, entry.previous)
    }
    emitStudyData()
    throw error
  }
}

/**
 * Writes one chunk: memory first, then IndexedDB. A card whose write fails is
 * skipped and restored; if the transaction itself fails the whole chunk is rolled
 * back and the error is rethrown.
 */
async function putCardsChunk(
  slice: Card[]
): Promise<{ importedIds: string[]; mediaDelta: EmbeddedCardMedia }> {
  const previousById = new Map(
    slice.map(card => [card.id, getCardFromMemory(card.id)])
  )
  for (const card of slice) putCardInMemory(card)

  const importedIds: string[] = []
  let mediaDelta = NO_MEDIA

  try {
    await withTransaction(
      [STORES.CARDS, STORES.SYNC_QUEUE],
      'readwrite',
      async stores => {
        for (const card of slice) {
          try {
            await promisifyRequest(stores[STORES.CARDS].put(card))
          } catch (reason) {
            console.warn('Failed to import card:', card.id, reason)
            restoreCardInMemory(card.id, previousById.get(card.id))
            continue
          }
          importedIds.push(card.id)
          const previous = previousById.get(card.id)
          mediaDelta = addEmbeddedMedia(
            mediaDelta,
            subEmbeddedMedia(
              sumEmbeddedCardMedia(card),
              previous ? sumEmbeddedCardMedia(previous) : NO_MEDIA
            )
          )
        }
        // Same transaction as the rows: an imported card always has its op.
        await putSyncQueueOps(
          stores[STORES.SYNC_QUEUE],
          importedIds.map(recordId => ({
            table: STORES.CARDS,
            recordId,
            operation: 'upsert' as const
          }))
        )
      }
    )
  } catch (error) {
    for (const [id, previous] of previousById) {
      restoreCardInMemory(id, previous)
    }
    throw error
  }

  return { importedIds, mediaDelta }
}

interface ChunkHooks {
  prepare?: ((slice: Card[]) => void) | undefined
  onProgress?: ((done: number, total: number) => void) | undefined
}

/** Persists cards in chunks (rows + outbox ops per transaction), notifies the UI once at the end. */
async function persistCardsInChunks(
  cards: Card[],
  { prepare, onProgress }: ChunkHooks = {}
): Promise<number> {
  const importedIds: string[] = []
  const total = cards.length
  let mediaDelta = NO_MEDIA

  try {
    for (let i = 0; i < cards.length; i += IMPORT_CHUNK) {
      const slice = cards.slice(i, i + IMPORT_CHUNK)
      prepare?.(slice)

      const chunk = await putCardsChunk(slice)
      importedIds.push(...chunk.importedIds)
      mediaDelta = addEmbeddedMedia(mediaDelta, chunk.mediaDelta)

      onProgress?.(Math.min(i + slice.length, total), total)
      if (i + IMPORT_CHUNK < cards.length) await yieldToMain()
    }
  } finally {
    emitStudyData()
  }

  await adjustCardMediaStats(mediaDelta)
  await refreshSyncQueueDepth()
  triggerSync()

  return importedIds.length
}

export async function importCards(
  source: File | string,
  topicId: string
): Promise<number> {
  const text = typeof source === 'string' ? source : await source.text()
  let data: { cards?: Card[] }

  try {
    data = parseImportJson(text) as { cards?: Card[] }
  } catch {
    throw new Error('Invalid JSON in import file')
  }

  if (!data.cards || !Array.isArray(data.cards)) {
    throw new Error('Invalid import file: missing or invalid cards[]')
  }

  const cardsToImport: Card[] = data.cards.map((card: Card) => ({
    ...card,
    id: card.id || crypto.randomUUID(),
    level: typeof card.level === 'number' ? card.level : 0,
    topicId,
    updatedAt: Date.now(),
    data: normalizeCardData(decodeCardData(card.data))
  }))

  return persistCardsInChunks(cardsToImport)
}

export type AnkiImportProgress =
  { phase: 'parsing' } | { phase: 'saving'; done: number; total: number }

export async function importAnkiApkg(
  file: File,
  topicId: string,
  onProgress?: (progress: AnkiImportProgress) => void
): Promise<number> {
  onProgress?.({ phase: 'parsing' })

  const [
    { runAnkiImportWorker },
    { sanitizeImportedCard },
    { assertApkgCompressedSize }
  ] = await Promise.all([
    import('@/lib/anki/run-anki-import-worker'),
    import('@/lib/anki/sanitize-imported-card'),
    import('@/lib/anki/parse-apkg')
  ])

  assertApkgCompressedSize(file.size)

  const cards = await runAnkiImportWorker(await file.arrayBuffer(), topicId)
  if (cards.length === 0) {
    throw new Error('No notes found in this .apkg')
  }

  // Sanitize each chunk on main, then persist — one monotonic Saving n/total.
  return persistCardsInChunks(cards, {
    prepare: slice => slice.forEach(card => sanitizeImportedCard(card)),
    onProgress: (done, total) => onProgress?.({ phase: 'saving', done, total })
  })
}

export async function shareCards(
  cardIds: string[],
  topicId: string,
  level: number
): Promise<void> {
  try {
    const topic = await getTopicById(topicId)
    if (!topic) throw new Error('Topic not found')
    const cards = getCardsByIds(cardIds)
    const fileName = `topic-${topic.topic.title}-level-${level}-${new Date().toISOString()}.json`
    const file = getJsonFile(cards, fileName)
    await shareFile(file, 'Cards')
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    throw error
  }
}
