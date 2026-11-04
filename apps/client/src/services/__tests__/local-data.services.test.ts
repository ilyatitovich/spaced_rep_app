import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CARDS_TOPIC_LEVEL_INDEX, STORES } from '@/lib/db'
import { Card, createTopic as buildTopic, type Topic } from '@/models'
import type { CardData } from '@/types'

// jsdom does not ship IDBKeyRange; services call IDBKeyRange.only().
if (typeof globalThis.IDBKeyRange === 'undefined') {
  globalThis.IDBKeyRange = {
    only: (value: IDBValidKey) =>
      ({
        lower: value,
        upper: value,
        lowerOpen: false,
        upperOpen: false
      }) as IDBKeyRange
  } as typeof IDBKeyRange
}

const memory = new Map<string, Map<string, unknown>>()
const enqueueSyncMock = vi.fn()
const enqueueSyncBulkMock = vi.fn()
const putSyncQueueOpsMock = vi.fn()
const triggerSyncMock = vi.fn()
const runAnkiImportWorkerMock = vi.fn()

function table(name: string): Map<string, unknown> {
  let rows = memory.get(name)
  if (!rows) {
    rows = new Map()
    memory.set(name, rows)
  }
  return rows
}

function idbRequest<T>(result: T): IDBRequest<T> {
  const request = {
    result,
    error: null as DOMException | null,
    onsuccess: null as ((this: IDBRequest<T>, ev: Event) => void) | null,
    onerror: null as ((this: IDBRequest<T>, ev: Event) => void) | null
  }
  queueMicrotask(() => {
    request.onsuccess?.call(request as IDBRequest<T>, {} as Event)
  })
  return request as IDBRequest<T>
}

function idbErrorRequest(name: string): IDBRequest {
  const error = new DOMException(name, name)
  const request = {
    result: undefined,
    error,
    onsuccess: null as ((this: IDBRequest, ev: Event) => void) | null,
    onerror: null as ((this: IDBRequest, ev: Event) => void) | null
  }
  queueMicrotask(() => {
    request.onerror?.call(request as IDBRequest, {} as Event)
  })
  return request as IDBRequest
}

function keyOf(value: { id?: string; key?: string }): string {
  return value.key ?? value.id ?? ''
}

function rangeKey(query: IDBValidKey | IDBKeyRange): IDBValidKey {
  if (
    typeof query === 'object' &&
    query !== null &&
    'lower' in query &&
    (query as IDBKeyRange).lower !== undefined
  ) {
    return (query as IDBKeyRange).lower
  }
  return query as IDBValidKey
}

function cardIndex(rows: Map<string, unknown>, indexName: string): IDBIndex {
  const cards = () => [...rows.values()] as Card[]

  const matched = (query?: IDBValidKey | IDBKeyRange) => {
    if (query === undefined) return cards()
    const key = rangeKey(query)
    if (indexName === 'topicId') {
      return cards().filter(card => card.topicId === key)
    }
    if (indexName === CARDS_TOPIC_LEVEL_INDEX) {
      const [topicId, level] = key as [string, number]
      return cards().filter(
        card => card.topicId === topicId && card.level === level
      )
    }
    return []
  }

  return {
    getAll: (query?: IDBValidKey | IDBKeyRange) => idbRequest(matched(query)),
    count: (query?: IDBValidKey | IDBKeyRange) =>
      idbRequest(matched(query).length)
  } as unknown as IDBIndex
}

vi.mock('@/lib/db', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/db')>()
  return {
    ...actual,
    withTransaction: vi.fn(
      async (
        storeNames: string[] | string,
        _mode: IDBTransactionMode,
        callback: (stores: Record<string, IDBObjectStore>) => Promise<unknown>
      ) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames]
        const stores: Record<string, IDBObjectStore> = {}
        for (const name of names) {
          const rows = table(name)
          stores[name] = {
            get: (key: IDBValidKey) => idbRequest(rows.get(String(key))),
            getAll: () => idbRequest([...rows.values()]),
            put: (value: { id?: string; key?: string }) => {
              const key = keyOf(value)
              rows.set(key, value)
              return idbRequest(key)
            },
            add: (value: { id?: string; key?: string; title?: string }) => {
              const key = keyOf(value)
              if (rows.has(key)) return idbErrorRequest('ConstraintError')
              if (name === STORES.TOPICS && value.title != null) {
                for (const row of rows.values()) {
                  // oxlint-disable-next-line sonarjs/nested-control-flow
                  if ((row as Topic).title === value.title) {
                    return idbErrorRequest('ConstraintError')
                  }
                }
              }
              rows.set(key, value)
              return idbRequest(key)
            },
            delete: (key: IDBValidKey) => {
              rows.delete(String(key))
              return idbRequest(undefined)
            },
            index: (indexName: string) => cardIndex(rows, indexName)
          } as unknown as IDBObjectStore
        }
        return callback(stores)
      }
    )
  }
})

vi.mock('@/lib/card-media-stats', () => ({
  adjustCardMediaStats: vi.fn(),
  addEmbeddedMedia: (
    a: { bytes: number; images: number; audio: number },
    b: { bytes: number; images: number; audio: number }
  ) => ({
    bytes: a.bytes + b.bytes,
    images: a.images + b.images,
    audio: a.audio + b.audio
  }),
  recordCardMediaDelete: vi.fn(),
  recordCardMediaUpsert: vi.fn(),
  sumEmbeddedCardMedia: vi.fn(() => ({ bytes: 0, images: 0, audio: 0 })),
  subEmbeddedMedia: (
    a: { bytes: number; images: number; audio: number },
    b: { bytes: number; images: number; audio: number }
  ) => ({
    bytes: a.bytes - b.bytes,
    images: a.images - b.images,
    audio: a.audio - b.audio
  })
}))

vi.mock('@/services/sync.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../sync.service')>()
  return {
    ...actual,
    enqueueSync: (...args: unknown[]) => enqueueSyncMock(...args),
    enqueueSyncBulk: (...args: unknown[]) => enqueueSyncBulkMock(...args),
    putSyncQueueOps: (...args: unknown[]) => putSyncQueueOpsMock(...args),
    triggerSync: (...args: unknown[]) => triggerSyncMock(...args),
    refreshSyncQueueDepth: vi.fn()
  }
})

vi.mock('@/lib/anki/run-anki-import-worker', () => ({
  runAnkiImportWorker: (...args: unknown[]) => runAnkiImportWorkerMock(...args)
}))

const { createTopic, deleteTopic, getAllTopics, getTopicById, updateTopic } =
  await import('../topic.services')
const {
  createCard,
  getCardsByTopicAndLevel,
  importAnkiApkg,
  importCards,
  updateCard,
  updateCardsLevelBulk
} = await import('../card.services')
const { importAppData } = await import('../backup.services')
const { __resetStudyMemoryForTests, getTopicFromMemory, hydrateStudyMemory } =
  await import('../study-memory')
const { withTransaction } = await import('../../lib/db')

function textCardData(front: string, back: string): CardData {
  return {
    front: {
      side: 'front',
      blocks: [{ type: 'text', html: `<p>${front}</p>` }]
    },
    back: {
      side: 'back',
      blocks: [{ type: 'text', html: `<p>${back}</p>` }]
    }
  }
}

async function seedTopic(title = 'Spanish'): Promise<Topic> {
  const topic = buildTopic(title)
  table(STORES.TOPICS).set(topic.id, topic)
  await hydrateStudyMemory()
  return topic
}

async function seedCard(
  topicId: string,
  level: number,
  overrides: Partial<Card> = {}
): Promise<Card> {
  const card = new Card(textCardData('Q', 'A'), topicId, level)
  Object.assign(card, overrides)
  table(STORES.CARDS).set(card.id, card)
  await hydrateStudyMemory()
  return card
}

describe('local data services', () => {
  beforeEach(() => {
    memory.clear()
    __resetStudyMemoryForTests()
    enqueueSyncMock.mockReset()
    enqueueSyncBulkMock.mockReset()
    putSyncQueueOpsMock.mockReset()
    triggerSyncMock.mockReset()
    runAnkiImportWorkerMock.mockReset()
    vi.mocked(withTransaction).mockClear()
  })

  /** Store lists of every transaction opened so far. */
  function openedTransactions(): string[][] {
    return vi
      .mocked(withTransaction)
      .mock.calls.map(([names]) =>
        Array.isArray(names) ? [...names] : [names]
      )
  }

  /**
   * A local write and its outbox op must commit or abort together: a crash
   * between two transactions would leave an edit that never syncs.
   */
  function expectWriteAndOutboxShareATransaction(dataStore: string): void {
    expect(
      openedTransactions().some(
        names => names.includes(dataStore) && names.includes(STORES.SYNC_QUEUE)
      )
    ).toBe(true)
    expect(putSyncQueueOpsMock).toHaveBeenCalled()
    expect(enqueueSyncMock).not.toHaveBeenCalled()
    expect(enqueueSyncBulkMock).not.toHaveBeenCalled()
  }

  describe('local write and outbox op are atomic', () => {
    it('createTopic', async () => {
      const topic = buildTopic('Atomic topic')
      await createTopic(topic)

      expectWriteAndOutboxShareATransaction(STORES.TOPICS)
      expect(putSyncQueueOpsMock).toHaveBeenCalledWith(expect.anything(), [
        { table: STORES.TOPICS, recordId: topic.id, operation: 'upsert' }
      ])
    })

    it('updateTopic', async () => {
      const seeded = await seedTopic('Atomic edit')
      const editable = (await getAllTopics()).find(t => t.id === seeded.id)
      if (!editable) throw new Error('expected seeded topic')
      editable.title = 'Atomic edited'
      await updateTopic(editable)

      expectWriteAndOutboxShareATransaction(STORES.TOPICS)
      expect(putSyncQueueOpsMock).toHaveBeenCalledWith(expect.anything(), [
        { table: STORES.TOPICS, recordId: seeded.id, operation: 'upsert' }
      ])
    })

    it('createCard', async () => {
      const topic = await seedTopic('Cards')
      const card = new Card(textCardData('Q', 'A'), topic.id, 0)
      await createCard(card)

      expectWriteAndOutboxShareATransaction(STORES.CARDS)
      expect(putSyncQueueOpsMock).toHaveBeenCalledWith(expect.anything(), [
        { table: STORES.CARDS, recordId: card.id, operation: 'upsert' }
      ])
    })

    it('updateCard', async () => {
      const topic = await seedTopic('Cards')
      const card = await seedCard(topic.id, 1)
      await updateCard(card)

      expectWriteAndOutboxShareATransaction(STORES.CARDS)
      expect(putSyncQueueOpsMock).toHaveBeenCalledWith(expect.anything(), [
        { table: STORES.CARDS, recordId: card.id, operation: 'upsert' }
      ])
    })

    it('updateCardsLevelBulk', async () => {
      const topic = await seedTopic('Cards')
      const a = await seedCard(topic.id, 1)
      const b = await seedCard(topic.id, 1)
      await updateCardsLevelBulk([a, b], 2)

      expectWriteAndOutboxShareATransaction(STORES.CARDS)
      expect(putSyncQueueOpsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          { table: STORES.CARDS, recordId: a.id, operation: 'upsert' },
          { table: STORES.CARDS, recordId: b.id, operation: 'upsert' }
        ])
      )
    })

    it('importCards', async () => {
      const topic = await seedTopic('Import')
      const id = crypto.randomUUID()
      await importCards(
        JSON.stringify({
          cards: [{ id, level: 1, data: textCardData('Q', 'A'), updatedAt: 1 }]
        }),
        topic.id
      )

      expectWriteAndOutboxShareATransaction(STORES.CARDS)
      expect(putSyncQueueOpsMock).toHaveBeenCalledWith(expect.anything(), [
        { table: STORES.CARDS, recordId: id, operation: 'upsert' }
      ])
    })

    it('importAppData', async () => {
      const topicId = crypto.randomUUID()
      const cardId = crypto.randomUUID()
      await importAppData(
        JSON.stringify({
          version: 1,
          topics: [
            {
              id: topicId,
              title: 'Backup',
              pivot: 1_700_000_000_000,
              week: [],
              nextUpdateDate: 1_700_000_100_000,
              updatedAt: 1_700_000_000_000,
              deletedAt: null
            }
          ],
          cards: [
            {
              id: cardId,
              topicId,
              level: 1,
              data: textCardData('Q', 'A'),
              updatedAt: 1_700_000_000_000
            }
          ]
        })
      )

      expectWriteAndOutboxShareATransaction(STORES.CARDS)
      expect(putSyncQueueOpsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          { table: STORES.TOPICS, recordId: topicId, operation: 'upsert' },
          { table: STORES.CARDS, recordId: cardId, operation: 'upsert' }
        ])
      )
    })
  })

  describe('createTopic', () => {
    it('throws on a duplicate title and leaves a single topic', async () => {
      const first = buildTopic('Spanish')
      await createTopic(first)

      const duplicate = buildTopic('Spanish')
      await expect(createTopic(duplicate)).rejects.toThrow(
        'A topic with the title "Spanish" already exists. Topic title must be unique.'
      )

      const topics = await getAllTopics()
      expect(topics).toHaveLength(1)
      const { topic } = await getTopicById(first.id)
      expect(topic.title).toBe('Spanish')
    })
  })

  describe('memory rollback when the IndexedDB write fails', () => {
    it('createTopic leaves nothing behind and enqueues nothing', async () => {
      vi.mocked(withTransaction).mockRejectedValueOnce(
        new DOMException('quota', 'QuotaExceededError')
      )
      const topic = buildTopic('Rollback me')

      await expect(createTopic(topic)).rejects.toThrow()
      expect(getTopicFromMemory(topic.id)).toBeUndefined()
      expect(enqueueSyncMock).not.toHaveBeenCalled()
    })

    it('updateTopic restores the previous value after an in-place edit', async () => {
      const seeded = await seedTopic('Edit me')
      const editable = (await getAllTopics()).find(t => t.id === seeded.id)
      if (!editable) throw new Error('expected seeded topic')

      editable.title = 'Edited'
      vi.mocked(withTransaction).mockRejectedValueOnce(
        new Error('write failed')
      )

      await expect(updateTopic(editable)).rejects.toThrow('write failed')
      expect(getTopicFromMemory(seeded.id)?.title).toBe('Edit me')
      expect(enqueueSyncMock).not.toHaveBeenCalled()
    })

    it('deleteTopic restores the topic and its cards', async () => {
      const topic = await seedTopic('Keep me')
      await seedCard(topic.id, 1)
      vi.mocked(withTransaction).mockRejectedValueOnce(
        new Error('write failed')
      )

      await expect(deleteTopic(topic.id)).rejects.toThrow('write failed')
      expect(getTopicFromMemory(topic.id)).toBeDefined()
      expect(await getCardsByTopicAndLevel(topic.id, 1)).toHaveLength(1)
    })
  })

  describe('getTopicById', () => {
    it('counts cards per level from memory', async () => {
      const topic = await seedTopic('Counts')
      await seedCard(topic.id, 1)
      await seedCard(topic.id, 1)
      await seedCard(topic.id, 4)
      await seedCard(crypto.randomUUID(), 1)

      const { levelCounts } = await getTopicById(topic.id)

      expect(levelCounts[1]).toBe(2)
      expect(levelCounts[4]).toBe(1)
      expect(levelCounts[0]).toBe(0)
    })
  })

  describe('deleteTopic', () => {
    it('removes the topic, every card, and queues a delete for each', async () => {
      const topic = await seedTopic('To delete')
      const cardA = await seedCard(topic.id, 1)
      const cardB = await seedCard(topic.id, 3)

      await deleteTopic(topic.id)

      await expect(getTopicById(topic.id)).rejects.toThrow(
        `Topic with ID ${topic.id} not found`
      )
      expect(await getCardsByTopicAndLevel(topic.id, 1)).toEqual([])
      expect(await getCardsByTopicAndLevel(topic.id, 3)).toEqual([])

      expect(putSyncQueueOpsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          {
            table: STORES.CARDS,
            recordId: cardA.id,
            operation: 'delete'
          },
          {
            table: STORES.CARDS,
            recordId: cardB.id,
            operation: 'delete'
          }
        ])
      )
      expect(putSyncQueueOpsMock).toHaveBeenCalledWith(expect.anything(), [
        {
          table: STORES.TOPICS,
          recordId: topic.id,
          operation: 'delete'
        }
      ])
    })
  })

  describe('importCards', () => {
    it('keeps a numeric level, rewrites topicId, and overwrites the same id', async () => {
      const topic = await seedTopic()
      const cardId = crypto.randomUUID()
      await seedCard(topic.id, 1, {
        id: cardId,
        data: textCardData('old front', 'old back')
      })

      const otherTopicId = crypto.randomUUID()
      const count = await importCards(
        JSON.stringify({
          cards: [
            {
              id: cardId,
              topicId: otherTopicId,
              level: 5,
              data: textCardData('new front', 'new back'),
              updatedAt: 1
            }
          ]
        }),
        topic.id
      )

      expect(count).toBe(1)
      expect(await getCardsByTopicAndLevel(topic.id, 1)).toEqual([])
      const cardsAt5 = await getCardsByTopicAndLevel(topic.id, 5)
      expect(cardsAt5).toHaveLength(1)
      const card = cardsAt5[0]
      if (!card) throw new Error('expected imported card')
      expect(card.id).toBe(cardId)
      expect(card.topicId).toBe(topic.id)
      expect(card.level).toBe(5)
      expect(card.data.front.blocks[0]).toMatchObject({
        type: 'text',
        html: '<p>new front</p>'
      })
    })

    it('throws when cards is missing and writes nothing', async () => {
      const topic = await seedTopic()
      const existing = await seedCard(topic.id, 2)

      await expect(
        importCards(JSON.stringify({ topic: {} }), topic.id)
      ).rejects.toThrow('Invalid import file: missing or invalid cards[]')

      const cardsAt2 = await getCardsByTopicAndLevel(topic.id, 2)
      expect(cardsAt2).toHaveLength(1)
      const card = cardsAt2[0]
      if (!card) throw new Error('expected existing card')
      expect(card.id).toBe(existing.id)
      expect(table(STORES.CARDS).size).toBe(1)
    })
  })

  describe('importAnkiApkg', () => {
    it('saves worker cards at level 0 through importAnkiApkg', async () => {
      const topic = await seedTopic()
      const ankiCardId = crypto.randomUUID()
      runAnkiImportWorkerMock.mockResolvedValue([
        {
          id: ankiCardId,
          topicId: topic.id,
          level: 0,
          updatedAt: Date.now(),
          data: textCardData('anki front', 'anki back')
        }
      ])

      const file = {
        name: 'deck.apkg',
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
      } as File
      const count = await importAnkiApkg(file, topic.id)

      expect(count).toBe(1)
      expect(runAnkiImportWorkerMock).toHaveBeenCalledOnce()
      const cardsAt0 = await getCardsByTopicAndLevel(topic.id, 0)
      expect(cardsAt0).toHaveLength(1)
      const card = cardsAt0[0]
      if (!card) throw new Error('expected anki card')
      expect(card.id).toBe(ankiCardId)
      expect(card.level).toBe(0)
      expect(card.topicId).toBe(topic.id)
    })
  })

  describe('importAppData', () => {
    it('merges: keeps existing, renames title clash, remaps non-UUID ids, returns file counts', async () => {
      const existing = await seedTopic('Spanish')
      const importTopicUuid = crypto.randomUUID()
      const remappedLegacyId = 'legacy-nanoid-topic'
      const remappedCardId = 'legacy-nanoid-card'

      const result = await importAppData(
        JSON.stringify({
          version: 1,
          topics: [
            {
              id: importTopicUuid,
              title: 'Spanish',
              pivot: 1_700_000_000_000,
              week: [],
              nextUpdateDate: 1_700_000_100_000,
              updatedAt: 1_700_000_000_000,
              deletedAt: null
            },
            {
              id: remappedLegacyId,
              title: 'French',
              pivot: 1_700_000_000_000,
              week: [],
              nextUpdateDate: 1_700_000_100_000,
              updatedAt: 1_700_000_000_000,
              deletedAt: null
            }
          ],
          cards: [
            {
              id: remappedCardId,
              topicId: remappedLegacyId,
              level: 2,
              data: textCardData('bonjour', 'hello'),
              updatedAt: 1_700_000_000_000
            }
          ]
        })
      )

      expect(result).toEqual({ topics: 2, cards: 1 })

      const { topic: kept } = await getTopicById(existing.id)
      expect(kept.title).toBe('Spanish')

      const { topic: renamed } = await getTopicById(importTopicUuid)
      expect(renamed.title).toBe(
        `Spanish (imported ${importTopicUuid.slice(0, 4)})`
      )

      const topics = await getAllTopics()
      const french = topics.find(t => t.title === 'French')
      expect(french).toBeDefined()
      expect(french!.id).not.toBe(remappedLegacyId)
      expect(french!.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )

      const frenchCards = await getCardsByTopicAndLevel(french!.id, 2)
      expect(frenchCards).toHaveLength(1)
      const card = frenchCards[0]
      if (!card) throw new Error('expected french card')
      expect(card.topicId).toBe(french!.id)
      expect(card.id).not.toBe(remappedCardId)
      expect(card.data.front.blocks[0]).toMatchObject({
        type: 'text',
        html: '<p>bonjour</p>'
      })
    })
  })
})
