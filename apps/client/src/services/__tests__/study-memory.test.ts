import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Card, createTopic as buildTopic } from '@/models'
import type { CardData } from '@/types'

const withTransactionMock = vi.fn()

vi.mock('@/lib/db', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/db')>()
  return {
    ...actual,
    withTransaction: (...args: unknown[]) => withTransactionMock(...args)
  }
})

const {
  __resetStudyMemoryForTests,
  deleteCardFromMemory,
  getAllTopicsFromMemory,
  getCardsByTopicFromMemory,
  getTopicFromMemory,
  hydrateStudyMemory,
  putCardInMemory,
  putTopicInMemory,
  restoreCardInMemory,
  subscribeStudyData
} = await import('../study-memory')

const data: CardData = {
  front: { side: 'front', blocks: [] },
  back: { side: 'back', blocks: [] }
}

beforeEach(() => {
  withTransactionMock.mockReset()
  __resetStudyMemoryForTests()
})

describe('hydrateStudyMemory', () => {
  it('loads topics and cards and notifies subscribers once', async () => {
    const topic = buildTopic('Loaded')
    const card = new Card(data, topic.id, 2)
    withTransactionMock.mockResolvedValue([[topic], [card]])
    const listener = vi.fn()
    subscribeStudyData(listener)

    await hydrateStudyMemory()

    expect(getTopicFromMemory(topic.id)?.title).toBe('Loaded')
    expect(getCardsByTopicFromMemory(topic.id)).toHaveLength(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('rejects and keeps the previous memory when IndexedDB fails', async () => {
    const topic = buildTopic('Kept')
    putTopicInMemory(topic)
    withTransactionMock.mockRejectedValue(new Error('idb unavailable'))

    await expect(hydrateStudyMemory()).rejects.toThrow('idb unavailable')
    expect(getTopicFromMemory(topic.id)?.title).toBe('Kept')
  })
})

describe('isolation', () => {
  it('does not let a caller mutate the stored topic through its own object', () => {
    const topic = buildTopic('Original')
    putTopicInMemory(topic)

    topic.title = 'Mutated by caller'

    expect(getTopicFromMemory(topic.id)?.title).toBe('Original')
  })

  it('does not let a caller mutate the stored topic through a read', () => {
    const topic = buildTopic('Original')
    putTopicInMemory(topic)

    const read = getTopicFromMemory(topic.id)
    if (!read) throw new Error('expected topic')
    read.title = 'Mutated by reader'

    expect(getAllTopicsFromMemory()[0]?.title).toBe('Original')
  })

  it('returns the pre-edit value from put so a rollback is real', () => {
    const card = new Card(data, 'topic-1', 1)
    putCardInMemory(card)

    card.level = 5
    const previous = putCardInMemory(card)

    expect(previous?.level).toBe(1)
  })
})

describe('per-topic card index', () => {
  it('follows a card that moves to another topic', () => {
    const card = new Card(data, 'topic-a', 0)
    putCardInMemory(card)

    putCardInMemory({ ...card, topicId: 'topic-b' })

    expect(getCardsByTopicFromMemory('topic-a')).toHaveLength(0)
    expect(getCardsByTopicFromMemory('topic-b')).toHaveLength(1)
  })

  it('is restored by rolling back a delete', () => {
    const card = new Card(data, 'topic-a', 0)
    putCardInMemory(card)

    const removed = deleteCardFromMemory(card.id)
    expect(getCardsByTopicFromMemory('topic-a')).toHaveLength(0)

    restoreCardInMemory(card.id, removed)
    expect(getCardsByTopicFromMemory('topic-a')).toHaveLength(1)
  })
})
