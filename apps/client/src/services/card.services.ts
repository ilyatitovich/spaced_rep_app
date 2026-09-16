import {
  enqueueSync,
  enqueueSyncBulk,
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
import { withTransaction, STORES, CARDS_TOPIC_LEVEL_INDEX } from '@/lib/db'
import { normalizeCardData } from '@/lib/normalize-card'
import { parseImportJson } from '@/lib/parse-import-json'
import { decodeCardData } from '@/lib/sync-serialize'
import { Card } from '@/models'

const IMPORT_CHUNK = 50

function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getCardById(cardId: string): Promise<Card | undefined> {
  return withTransaction(STORES.CARDS, 'readonly', stores =>
    promisifyRequest<Card | undefined>(
      stores[STORES.CARDS].get(cardId) as IDBRequest<Card | undefined>
    )
  )
}

export async function getCardsByTopicAndLevel(
  topicId: string,
  level: number
): Promise<Card[]> {
  return withTransaction([STORES.CARDS], 'readonly', async stores => {
    const index = stores[STORES.CARDS].index(CARDS_TOPIC_LEVEL_INDEX)
    const request = index.getAll(IDBKeyRange.only([topicId, level]))

    const cards = await new Promise<Card[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as Card[])
      request.onerror = () =>
        reject(request.error ?? new Error('Failed to fetch cards by level'))
    })

    return cards.map(card => ({
      ...card,
      data: normalizeCardData(card.data)
    }))
  })
}

export async function createCard(card: Card): Promise<void> {
  try {
    await withTransaction(STORES.CARDS, 'readwrite', async stores => {
      await new Promise((resolve, reject) => {
        const request = stores[STORES.CARDS].add(card)
        request.onsuccess = () => resolve(undefined)
        request.onerror = () => reject(request.error)
      })
    })
    await recordCardMediaUpsert(undefined, card)
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    triggerSync()
  } catch (error) {
    console.error('Failed to save card:', error)
    throw error
  }
}

export async function updateCard(card: Card): Promise<void> {
  try {
    card.updatedAt = Date.now()
    const previous = await getCardById(card.id)

    await withTransaction([STORES.CARDS], 'readwrite', async stores => {
      await new Promise<void>((resolve, reject) => {
        const request = stores[STORES.CARDS].put(card)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })
    await recordCardMediaUpsert(previous, card)
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    triggerSync()
  } catch (error) {
    console.error('Failed to update card:', error)
    throw error
  }
}

export async function deleteCardById(cardId: string): Promise<void> {
  const previous = await getCardById(cardId)
  await withTransaction([STORES.CARDS], 'readwrite', stores => {
    return new Promise<void>((resolve, reject) => {
      const req = stores[STORES.CARDS].delete(cardId)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })

  if (previous) await recordCardMediaDelete(previous)
  await enqueueSync(STORES.CARDS, cardId, 'delete')
  triggerSync()
}

export async function deleteCardsBulk(cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return

  let mediaDelta: EmbeddedCardMedia = {
    bytes: 0,
    images: 0,
    audio: 0
  }

  for (let i = 0; i < cardIds.length; i += IMPORT_CHUNK) {
    const slice = cardIds.slice(i, i + IMPORT_CHUNK)

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

        for (const id of slice) {
          const card = await promisifyRequest<Card | undefined>(
            stores[STORES.CARDS].get(id) as IDBRequest<Card | undefined>
          )
          await promisifyRequest(stores[STORES.CARDS].delete(id))
          if (card) {
            deletedIds.push(id)
            delta = addEmbeddedMedia(
              delta,
              subEmbeddedMedia(
                { bytes: 0, images: 0, audio: 0 },
                sumEmbeddedCardMedia(card)
              )
            )
          }
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
    if (i + IMPORT_CHUNK < cardIds.length) await yieldToMain()
  }

  await adjustCardMediaStats(mediaDelta)
  await refreshSyncQueueDepth()
  triggerSync()
}

export async function updateCardsLevelBulk(
  cards: Card[],
  level: number
): Promise<void> {
  if (cards.length === 0) return

  const now = Date.now()
  for (const card of cards) {
    card.level = level
    card.updatedAt = now
  }

  await withTransaction([STORES.CARDS], 'readwrite', async stores => {
    return new Promise<void>((resolve, reject) => {
      let remaining = cards.length

      for (const card of cards) {
        const req = stores[STORES.CARDS].put(card)

        req.onerror = () => {
          reject(req.error ?? new Error(`Failed to update card ${card.id}`))
        }

        req.onsuccess = () => {
          remaining -= 1
          if (remaining === 0) resolve()
        }
      }
    })
  })

  await enqueueSyncBulk(
    cards.map(card => ({
      table: STORES.CARDS,
      recordId: card.id,
      operation: 'upsert' as const
    }))
  )
  triggerSync()
}

export async function migrateCardsToNewSchema(): Promise<void> {
  return withTransaction([STORES.CARDS], 'readwrite', async stores => {
    return new Promise<void>((resolve, reject) => {
      const request = stores[STORES.CARDS].getAll() as IDBRequest<Card[]>

      request.onsuccess = () => {
        const oldCards = request.result

        let remaining = oldCards.length
        if (remaining === 0) {
          resolve()
          return
        }

        for (let card of oldCards) {
          card = {
            ...card,
            updatedAt: Date.now(),
            data: normalizeCardData({
              front: {
                type: 'text',
                side: 'front',
                content:
                  typeof card.data.front === 'string'
                    ? card.data.front
                    : ((card.data.front as { content?: unknown })?.content ??
                      '')
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

          const req = stores[STORES.CARDS].put(card)

          req.onerror = () => {
            reject(req.error ?? new Error(`Failed to update card ${card.id}`))
          }

          req.onsuccess = () => {
            remaining -= 1
            if (remaining === 0) resolve()
          }
        }
      }
    })
  })
}

async function persistImportedCards(
  cards: Card[],
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const importedIds: string[] = []
  const total = cards.length
  let mediaDelta: EmbeddedCardMedia = {
    bytes: 0,
    images: 0,
    audio: 0
  }

  for (let i = 0; i < cards.length; i += IMPORT_CHUNK) {
    const slice = cards.slice(i, i + IMPORT_CHUNK)

    await withTransaction([STORES.CARDS], 'readwrite', async stores => {
      for (const card of slice) {
        const previous = await promisifyRequest<Card | undefined>(
          stores[STORES.CARDS].get(card.id) as IDBRequest<Card | undefined>
        )
        try {
          await promisifyRequest(stores[STORES.CARDS].put(card))
          importedIds.push(card.id)
          mediaDelta = addEmbeddedMedia(
            mediaDelta,
            subEmbeddedMedia(
              sumEmbeddedCardMedia(card),
              previous
                ? sumEmbeddedCardMedia(previous)
                : { bytes: 0, images: 0, audio: 0 }
            )
          )
        } catch (reason) {
          console.warn('Failed to import card:', card.id, reason)
        }
      }
    })

    onProgress?.(Math.min(i + slice.length, total), total)
    if (i + IMPORT_CHUNK < cards.length) await yieldToMain()
  }

  await adjustCardMediaStats(mediaDelta)

  await enqueueSyncBulk(
    importedIds.map(id => ({
      table: STORES.CARDS,
      recordId: id,
      operation: 'upsert' as const
    }))
  )
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

  return persistImportedCards(cardsToImport)
}

export type AnkiImportProgress =
  | { phase: 'parsing' }
  | { phase: 'saving'; done: number; total: number }

export async function importAnkiApkg(
  file: File,
  topicId: string,
  onProgress?: (progress: AnkiImportProgress) => void
): Promise<number> {
  onProgress?.({ phase: 'parsing' })

  const [{ runAnkiImportWorker }, { sanitizeImportedCard }] = await Promise.all([
    import('@/lib/anki/run-anki-import-worker'),
    import('@/lib/anki/sanitize-imported-card')
  ])

  const cards = await runAnkiImportWorker(await file.arrayBuffer(), topicId)
  if (cards.length === 0) {
    throw new Error('No notes found in this .apkg')
  }

  // Sanitize each chunk on main, then persist — one monotonic Saving n/total.
  const importedIds: string[] = []
  const total = cards.length
  let mediaDelta: EmbeddedCardMedia = {
    bytes: 0,
    images: 0,
    audio: 0
  }

  for (let i = 0; i < cards.length; i += IMPORT_CHUNK) {
    const slice = cards.slice(i, i + IMPORT_CHUNK)
    for (const card of slice) sanitizeImportedCard(card)

    await withTransaction([STORES.CARDS], 'readwrite', async stores => {
      for (const card of slice) {
        const previous = await promisifyRequest<Card | undefined>(
          stores[STORES.CARDS].get(card.id) as IDBRequest<Card | undefined>
        )
        try {
          await promisifyRequest(stores[STORES.CARDS].put(card))
          importedIds.push(card.id)
          mediaDelta = addEmbeddedMedia(
            mediaDelta,
            subEmbeddedMedia(
              sumEmbeddedCardMedia(card),
              previous
                ? sumEmbeddedCardMedia(previous)
                : { bytes: 0, images: 0, audio: 0 }
            )
          )
        } catch (reason) {
          console.warn('Failed to import card:', card.id, reason)
        }
      }
    })

    onProgress?.({
      phase: 'saving',
      done: Math.min(i + slice.length, total),
      total
    })
    if (i + IMPORT_CHUNK < cards.length) await yieldToMain()
  }

  await adjustCardMediaStats(mediaDelta)

  await enqueueSyncBulk(
    importedIds.map(id => ({
      table: STORES.CARDS,
      recordId: id,
      operation: 'upsert' as const
    }))
  )
  triggerSync()

  return importedIds.length
}
