import { withTransaction, STORES, arrayBufferToBase64, isRecord } from '@/lib'
import { Topic, Card, TopicPlain } from '@/models'

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
        let topics = (request.result as Topic[]).map(t => Topic.fromRaw(t))

        topics = topics.map(t => {
          if (t.nextUpdateDate <= Date.now()) {
            t.updateWeek()
          }
          return t
        })

        resolve(topics)
      }

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to fetch topics'))
      }
    })
  })
}

export async function getTopicById(
  topicId: string
): Promise<{ topic: Topic; cards: Record<number, Card[]> }> {
  return withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readonly',
    async stores => {
      const topicStore = stores[STORES.TOPICS]
      const cardStore = stores[STORES.CARDS]

      const topicRequest = topicStore.get(topicId)

      let topic = await new Promise<Topic | undefined>((resolve, reject) => {
        topicRequest.onsuccess = () => resolve(topicRequest.result)
        topicRequest.onerror = () =>
          reject(topicRequest.error ?? new Error('Failed to fetch topic'))
      })

      if (!topic) {
        throw new Error(`Topic with ID ${topicId} not found`)
      }

      topic = Topic.fromRaw(topic)

      if (topic.nextUpdateDate <= Date.now()) {
        topic.updateWeek()
        await updateTopic(topic)
      }

      const cardsIndex = cardStore.index('topicId')
      const cardsRequest = cardsIndex.getAll(IDBKeyRange.only(topicId))

      const cards = await new Promise<Card[]>((resolve, reject) => {
        cardsRequest.onsuccess = () => resolve(cardsRequest.result)
        cardsRequest.onerror = () =>
          reject(cardsRequest.error ?? new Error('Failed to fetch cards'))
      })

      const topicCards = cards.reduce<Record<number, Card[]>>((acc, card) => {
        const level = card.level
        if (!acc[level]) {
          acc[level] = []
        }
        acc[level].push(card)
        return acc
      }, {})

      return { topic, cards: topicCards }
    }
  )
}

export async function deleteTopic(topicId: string): Promise<void> {
  await withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readwrite',
    async stores => {
      const topicStore = stores[STORES.TOPICS]
      const cardStore = stores[STORES.CARDS]

      // Delete the topic
      await new Promise<void>((resolve, reject) => {
        const request = topicStore.delete(topicId)
        request.onsuccess = () => resolve()
        request.onerror = () =>
          reject(request.error ?? new Error('Failed to delete topic'))
      })

      // Delete all cards for that topic using index
      const index = cardStore.index('topicId')
      const range = IDBKeyRange.only(topicId)

      return new Promise<void>((resolve, reject) => {
        const request = index.openCursor(range)

        request.onsuccess = () => {
          const cursor = request.result
          if (cursor) {
            cursor.delete()
            cursor.continue()
          } else {
            resolve()
          }
        }

        request.onerror = () =>
          reject(request.error ?? new Error('Failed to delete topic cards'))
      })
    }
  )
}

export async function updateTopic(topic: TopicPlain): Promise<void> {
  await withTransaction([STORES.TOPICS], 'readwrite', async stores => {
    const store = stores[STORES.TOPICS]

    await new Promise<void>((resolve, reject) => {
      const request = store.put(topic)
      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(request.error ?? new Error('Failed to update topic'))
    })
  })
}

export async function exportTopic(
  topicId: string
): Promise<Record<string, string>> {
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

      if (!topic) {
        throw new Error(`Topic with ID ${topicId} not found`)
      }

      const cardsIndex = cardStore.index('topicId')
      const cardsRequest = cardsIndex.getAll(IDBKeyRange.only(topicId))

      const cards = await new Promise<Card[]>((resolve, reject) => {
        cardsRequest.onsuccess = () => resolve(cardsRequest.result)
        cardsRequest.onerror = () =>
          reject(cardsRequest.error ?? new Error('Failed to fetch cards'))
      })

      const processedCards = cards.map((card: Card) => ({
        ...card,
        data: {
          front: {
            ...card.data.front,
            content: isRecord(card.data.front.content)
              ? arrayBufferToBase64(card.data.front.content)
              : card.data.front.content
          },
          back: {
            ...card.data.back,
            content: isRecord(card.data.back.content)
              ? arrayBufferToBase64(card.data.back.content)
              : card.data.back.content
          }
        }
      }))

      const payload = {
        exportedAt: new Date().toISOString(),
        topic: {
          id: topic.id,
          title: topic.title,
          pivot: topic.pivot
        },
        cards: processedCards
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json'
      })

      const url = URL.createObjectURL(blob)

      return {
        fileUrl: url,
        fileName: `topic-${topic.title}-${topic.id}-${payload.exportedAt}.json`
      }
    }
  )
}
