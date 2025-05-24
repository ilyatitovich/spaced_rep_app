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
