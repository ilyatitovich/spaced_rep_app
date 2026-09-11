import { enqueueSync, triggerSync } from './sync.service'
import { withTransaction, STORES, CARDS_TOPIC_LEVEL_INDEX } from '@/lib/db'
import { normalizeCardData } from '@/lib/normalize-card'
import { decodeCardData } from '@/lib/sync-serialize'
import { Card } from '@/models'

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

    await withTransaction([STORES.CARDS], 'readwrite', async stores => {
      await new Promise<void>((resolve, reject) => {
        const request = stores[STORES.CARDS].put(card)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    triggerSync()
  } catch (error) {
    console.error('Failed to update card:', error)
    throw error
  }
}

export async function deleteCardById(cardId: string): Promise<void> {
  await withTransaction([STORES.CARDS], 'readwrite', stores => {
    return new Promise<void>((resolve, reject) => {
      const req = stores[STORES.CARDS].delete(cardId)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })

  await enqueueSync(STORES.CARDS, cardId, 'delete')
  triggerSync()
}

export async function deleteCardsBulk(cardIds: string[]): Promise<void> {
  await withTransaction([STORES.CARDS], 'readwrite', async stores => {
    return new Promise<void>((resolve, reject) => {
      let remaining = cardIds.length

      for (const id of cardIds) {
        const req = stores[STORES.CARDS].delete(id)

        req.onerror = () => {
          reject(req.error ?? new Error(`Failed to delete card ${id}`))
        }

        req.onsuccess = () => {
          remaining -= 1
          if (remaining === 0) resolve()
        }
      }
    })
  })

  for (const id of cardIds) {
    await enqueueSync(STORES.CARDS, id, 'delete')
  }
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

  for (const card of cards) {
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
  }
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

const IMPORT_CHUNK = 50

function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

async function persistImportedCards(
  cards: Card[],
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const importedIds: string[] = []
  const total = cards.length

  for (let i = 0; i < cards.length; i += IMPORT_CHUNK) {
    const slice = cards.slice(i, i + IMPORT_CHUNK)

    await withTransaction([STORES.CARDS], 'readwrite', async stores => {
      const results = await Promise.allSettled(
        slice.map(
          card =>
            new Promise<void>((resolve, reject) => {
              const req = stores[STORES.CARDS].put(card)
              req.onsuccess = () => resolve()
              req.onerror = () => reject(req.error)
            })
        )
      )

      results.forEach((result, j) => {
        if (result.status === 'fulfilled') {
          importedIds.push(slice[j].id)
        } else {
          console.warn('Failed to import card:', slice[j].id, result.reason)
        }
      })
    })

    onProgress?.(Math.min(i + slice.length, total), total)
    if (i + IMPORT_CHUNK < cards.length) await yieldToMain()
  }

  for (const id of importedIds) {
    await enqueueSync(STORES.CARDS, id, 'upsert')
  }
  triggerSync()

  return importedIds.length
}

export async function importCards(
  file: File,
  topicId: string
): Promise<number> {
  const text = await file.text()
  let data

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON in import file')
  }

  if (!data.cards || !Array.isArray(data.cards)) {
    throw new Error('Invalid import file: missing or invalid cards[]')
  }

  const cardsToImport: Card[] = data.cards.map((card: Card) => ({
    ...card,
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

  for (let i = 0; i < cards.length; i += IMPORT_CHUNK) {
    const slice = cards.slice(i, i + IMPORT_CHUNK)
    for (const card of slice) sanitizeImportedCard(card)

    await withTransaction([STORES.CARDS], 'readwrite', async stores => {
      const results = await Promise.allSettled(
        slice.map(
          card =>
            new Promise<void>((resolve, reject) => {
              const req = stores[STORES.CARDS].put(card)
              req.onsuccess = () => resolve()
              req.onerror = () => reject(req.error)
            })
        )
      )

      results.forEach((result, j) => {
        if (result.status === 'fulfilled') {
          importedIds.push(slice[j].id)
        } else {
          console.warn('Failed to import card:', slice[j].id, result.reason)
        }
      })
    })

    onProgress?.({
      phase: 'saving',
      done: Math.min(i + slice.length, total),
      total
    })
    if (i + IMPORT_CHUNK < cards.length) await yieldToMain()
  }

  for (const id of importedIds) {
    await enqueueSync(STORES.CARDS, id, 'upsert')
  }
  triggerSync()

  return importedIds.length
}
