import { withTransaction, STORES } from '../lib/db'
import { Topic } from '../lib/definitions'

export async function createTopic(topic: Topic): Promise<void> {
  const normalizedTopic = { ...topic, name: topic.title.toLowerCase() }

  try {
    await withTransaction(STORES.TOPICS, 'readwrite', async store => {
      await new Promise((resolve, reject) => {
        const request = store.add(normalizedTopic)
        request.onsuccess = () => resolve(undefined)
        request.onerror = () => reject(request.error)
      })
    })
  } catch (error) {
    if ((error as Error).name === 'ConstraintError') {
      throw new Error(
        `A topic with the title "${topic.title}" already exists. Topic title must be unique.`
      )
    }
    console.error('Failed to save topic:', error)
    throw error
  }
}
