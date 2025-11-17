import { withTransaction, STORES } from '@/lib/db'
import { Card } from '@/models'

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
