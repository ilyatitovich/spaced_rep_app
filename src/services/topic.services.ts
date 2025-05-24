import { withTransaction, STORES } from '../lib/db'
import { Topic, Card } from '@/models'

export async function createTopic(topic: Topic): Promise<void> {
  try {
    await withTransaction(STORES.TOPICS, 'readwrite', async stores => {
      await new Promise((resolve, reject) => {
        const request = stores[STORES.TOPICS].add(topic)
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
  return withTransaction(STORES.TOPICS, 'readonly', async stores => {
    return new Promise((resolve, reject) => {
      const request = stores[STORES.TOPICS].getAll()

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
  return withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readonly',
    async stores => {
      const topicStore = stores[STORES.TOPICS]
      const cardStore = stores[STORES.CARDS]

      const topicRequest = topicStore.get(topicId)

      const topic = await new Promise<Topic | undefined>((resolve, reject) => {
        topicRequest.onsuccess = () => resolve(topicRequest.result)
        topicRequest.onerror = () =>
          reject(topicRequest.error ?? new Error('Failed to fetch topic'))
      })

      if (!topic) return null

      const cardsIndex = cardStore.index('topicId')
      const cardsRequest = cardsIndex.getAll(IDBKeyRange.only(topicId))

      const cards = await new Promise<Card[]>((resolve, reject) => {
        cardsRequest.onsuccess = () => resolve(cardsRequest.result)
        cardsRequest.onerror = () =>
          reject(cardsRequest.error ?? new Error('Failed to fetch cards'))
      })

      cards.forEach(card => {
        const cardLevel = card.level
        topic.levels[cardLevel].cards.push(card)
      })

      return topic
    }
  )
}

export async function deleteTopic(topicId: string): Promise<void> {
  return withTransaction(STORES.TOPICS, 'readwrite', async stores => {
    return new Promise((resolve, reject) => {
      const request = stores[STORES.TOPICS].delete(topicId)

      request.onsuccess = () => resolve()
      request.onerror = () => {
        reject(request.error ?? new Error('Failed to delete topic'))
      }
    })
  })
}
