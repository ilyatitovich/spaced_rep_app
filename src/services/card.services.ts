import { base64ToArrayBuffer, isBase64Image } from '@/lib'
import { withTransaction, STORES } from '@/lib/db'
import { Card } from '@/models'
import { ImageBase64Record } from '@/types'

export async function createCard(card: Card): Promise<void> {
  try {
    await withTransaction(STORES.CARDS, 'readwrite', async stores => {
      await new Promise((resolve, reject) => {
        const request = stores[STORES.CARDS].add(card)
        request.onsuccess = () => resolve(undefined)
        request.onerror = () => reject(request.error)
      })
    })
  } catch (error) {
    console.error('Failed to save card:', error)
    throw error
  }
}

export async function updateCard(card: Card): Promise<void> {
  try {
    await withTransaction([STORES.CARDS], 'readwrite', async stores => {
      await new Promise<void>((resolve, reject) => {
        const request = stores[STORES.CARDS].put(card)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })
  } catch (error) {
    console.error('Failed to update card:', error)
    throw error
  }
}

export function deleteCardById(cardId: string): Promise<void> {
  return withTransaction([STORES.CARDS], 'readwrite', stores => {
    return new Promise((resolve, reject) => {
      const req = stores[STORES.CARDS].delete(cardId)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
}

export async function deleteCardsBulk(cardIds: string[]): Promise<void> {
  return withTransaction([STORES.CARDS], 'readwrite', async stores => {
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
}

export async function migrateCardsToNewSchema(): Promise<void> {
  return withTransaction([STORES.CARDS], 'readwrite', async stores => {
    return new Promise<void>((resolve, reject) => {
      const request = stores[STORES.CARDS].getAll() as IDBRequest<Card[]>

      request.onsuccess = () => {
        const oldCards = request.result

        let remaining = oldCards.length

        for (let card of oldCards) {
          // Set new schema
          card = {
            id: card.id,
            topicId: card.topicId,
            level: card.level,
            data: {
              front: {
                type: 'text',
                side: 'front',
                content: card.data.front as unknown as string
              },
              back: {
                type: 'text',
                side: 'back',
                content: card.data.back as unknown as string
              }
            }
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
    data: {
      front: {
        ...card.data.front,
        content: isBase64Image(card.data.front.content)
          ? base64ToArrayBuffer(
              card.data.front.content as unknown as ImageBase64Record
            )
          : card.data.front.content
      },
      back: {
        ...card.data.back,
        content: isBase64Image(card.data.back.content)
          ? base64ToArrayBuffer(
              card.data.back.content as unknown as ImageBase64Record
            )
          : card.data.back.content
      }
    }
  }))

  let successCount = 0

  await withTransaction([STORES.CARDS], 'readwrite', async stores => {
    const results = await Promise.allSettled(
      cardsToImport.map(
        card =>
          new Promise<void>((resolve, reject) => {
            const req = stores[STORES.CARDS].put(card)
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
          })
      )
    )

    successCount = results.filter(r => r.status === 'fulfilled').length

    // Log failed ones
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.warn(
          'Failed to import card:',
          cardsToImport[i].id,
          result.reason
        )
      }
    })
  })

  return successCount
}
