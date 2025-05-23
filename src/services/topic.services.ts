import { withTransaction, STORES } from '../lib/db'
import { Topic } from '../lib/definitions'

export async function createTopic(topic: Topic): Promise<void> {
  try {
    await withTransaction(STORES.TOPICS, 'readwrite', async store => {
      await new Promise((resolve, reject) => {
        const request = store.add(topic)
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

export async function getAllTopics(): Promise<Topic[]> {
  return withTransaction(STORES.TOPICS, 'readonly', async store => {
    return new Promise((resolve, reject) => {
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to fetch topics'))
      }
    })
  })
}

export async function getTopicById(topicId: string): Promise<Topic | null> {
  return withTransaction(STORES.TOPICS, 'readonly', async store => {
    return new Promise((resolve, reject) => {
      const request = store.get(topicId)

      request.onsuccess = () => {
        const topic = request.result as Topic | undefined
        resolve(topic ?? null)
      }

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to fetch topic by ID'))
      }
    })
  })
}
