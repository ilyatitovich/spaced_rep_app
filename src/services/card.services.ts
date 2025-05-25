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
      const store = stores[STORES.CARDS]

      await new Promise<void>((resolve, reject) => {
        const request = store.put(card)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })
  } catch (error) {
    console.error('Failed to update card:', error)
    throw error
  }
}
