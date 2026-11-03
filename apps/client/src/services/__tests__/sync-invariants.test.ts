import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORES, withTransaction } from '@/lib/db'
import { Card, createTopic as buildTopic, type Topic } from '@/models'
import type { CardData } from '@/types'
import type { PullDelta, PushAck } from '@spaced-rep/sync-protocol'
import { memory, table } from './helpers/fake-idb'
import {
  EPOCH_ISO,
  acceptAll,
  emptyDelta,
  metaValue,
  rejectRetryable,
  seedMeta
} from './helpers/sync-fixtures'

const pushMock = vi.fn()
const pullMock = vi.fn()
const bootstrapMock = vi.fn()
const uploadOwnedMediaMock = vi.fn()
const hydrateIncomingCardDataMock = vi.fn()

vi.mock('@/lib/db', async () =>
  (await import('./helpers/fake-idb')).fakeDbModule()
)

vi.mock('@/lib/card-media-stats', async () =>
  (await import('./helpers/sync-mocks')).cardMediaStatsModule()
)

vi.mock('@/providers', async () =>
  (await import('./helpers/sync-mocks')).providersModule({
    push: pushMock,
    pull: pullMock,
    bootstrap: bootstrapMock
  })
)

vi.mock('@/lib/sync-media', async () =>
  (await import('./helpers/sync-mocks')).syncMediaModule({
    uploadOwnedMedia: uploadOwnedMediaMock,
    hydrateIncomingCardData: hydrateIncomingCardDataMock
  })
)

vi.mock('../sync-http.client', async () =>
  (await import('./helpers/sync-mocks')).syncHttpClientModule()
)

const {
  __resetSyncServiceForTests,
  applyPullDelta,
  clearLocalSyncData,
  enqueueSync,
  initialSync,
  pushChanges,
  setSyncEntitlement,
  setSyncUser,
  syncAll
} = await import('../sync.service')
const { deleteCardById } = await import('../card.services')
const { __resetStudyMemoryForTests, hydrateStudyMemory } =
  await import('../study-memory')

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

function textCardData(front: string, back: string): CardData {
  return {
    front: {
      side: 'front',
      blocks: [{ type: 'text', html: `<p>${front}</p>` }]
    },
    back: { side: 'back', blocks: [{ type: 'text', html: `<p>${back}</p>` }] }
  }
}

async function seedCard(updatedAt = 1_000): Promise<Card> {
  const card = new Card(textCardData('Q', 'A'), 'topic-1', 0)
  card.updatedAt = updatedAt
  table(STORES.CARDS).set(card.id, card)
  await hydrateStudyMemory()
  return card
}

async function seedTopic(title: string, updatedAt = 1_000): Promise<Topic> {
  const topic = buildTopic(title)
  topic.updatedAt = updatedAt
  table(STORES.TOPICS).set(topic.id, topic)
  await hydrateStudyMemory()
  return topic
}

function remoteCard(
  id: string,
  overrides: { updatedAt: number; deletedAt?: number | null; front?: string }
) {
  return {
    card: {
      id,
      topicId: 'topic-1',
      level: 0,
      dataJson: JSON.stringify(textCardData(overrides.front ?? 'S', 'S')),
      reviewDate: null,
      updatedAt: overrides.updatedAt,
      deletedAt: overrides.deletedAt ?? null
    }
  }
}

function queueRow(table_: string, recordId: string) {
  return table(STORES.SYNC_QUEUE).get(`${table_}:${recordId}`) as
    { opId: string; operation: string } | undefined
}

beforeEach(() => {
  memory.clear()
  __resetStudyMemoryForTests()
  for (const m of [
    pushMock,
    pullMock,
    bootstrapMock,
    uploadOwnedMediaMock,
    hydrateIncomingCardDataMock
  ]) {
    m.mockReset()
  }
  hydrateIncomingCardDataMock.mockImplementation(
    async (delta: PullDelta) =>
      new Map(
        delta.records
          .filter(r => r.card)
          .map(r => [r.card!.id, JSON.parse(r.card!.dataJson)])
      )
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
  seedMeta('deviceId', 'device-1')
})

afterEach(() => {
  __resetSyncServiceForTests()
  __resetStudyMemoryForTests()
  vi.restoreAllMocks()
})

describe('queue coalescing', () => {
  it('idle create-then-delete leaves an empty queue', async () => {
    await enqueueSync(STORES.CARDS, 'card-1', 'upsert')
    expect(queueRow(STORES.CARDS, 'card-1')?.operation).toBe('upsert')

    await enqueueSync(STORES.CARDS, 'card-1', 'delete')

    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
  })

  it('stamps a queued delete with when it happened, not when it is pushed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(10_000)
      await enqueueSync(STORES.CARDS, 'card-1', 'delete')

      // Offline for a while: another device edits the card in the meantime,
      // so a push-time stamp would let this older delete win LWW.
      vi.setSystemTime(20_000)
      pushMock.mockImplementationOnce(async input => acceptAll(input))
      await pushChanges('device-1')

      expect(pushMock.mock.calls[0]![0].mutations[0]).toMatchObject({
        operation: 'delete',
        recordId: 'card-1',
        updatedAt: 10_000
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('in-flight ack of an upsert does not drop a delete that replaced it', async () => {
    const card = await seedCard()
    await enqueueSync(STORES.CARDS, card.id, 'upsert')

    const firstAck = deferred<PushAck>()
    pushMock.mockImplementationOnce(() => firstAck.promise)
    pushMock.mockImplementationOnce(async input => rejectRetryable(input))

    const pushing = pushChanges('device-1')
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1))
    const upsertOpId = pushMock.mock.calls[0]![0].mutations[0].opId as string

    await enqueueSync(STORES.CARDS, card.id, 'delete')
    firstAck.resolve({
      acceptedOpIds: [upsertOpId],
      rejected: [],
      conflicts: []
    })
    await pushing

    const row = queueRow(STORES.CARDS, card.id)
    expect(row?.operation).toBe('delete')
    expect(row?.opId).not.toBe(upsertOpId)
    const second = pushMock.mock.calls[1]![0].mutations[0]
    expect(second).toMatchObject({ operation: 'delete', recordId: card.id })
  })

  it('in-flight ack of an upsert does not drop a newer edit (new opId minted)', async () => {
    const card = await seedCard()
    await enqueueSync(STORES.CARDS, card.id, 'upsert')

    const firstAck = deferred<PushAck>()
    pushMock.mockImplementationOnce(() => firstAck.promise)
    pushMock.mockImplementationOnce(async input => rejectRetryable(input))

    const pushing = pushChanges('device-1')
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1))
    const upsertOpId = pushMock.mock.calls[0]![0].mutations[0].opId as string

    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    firstAck.resolve({
      acceptedOpIds: [upsertOpId],
      rejected: [],
      conflicts: []
    })
    await pushing

    const row = queueRow(STORES.CARDS, card.id)
    expect(row?.operation).toBe('upsert')
    expect(row?.opId).not.toBe(upsertOpId)
  })
})

describe('pull watermark and post-push pull', () => {
  it('applyPullDelta never moves lastPulledAt backward', async () => {
    seedMeta('lastPulledAt', '2024-06-01T00:00:00.000Z')

    await applyPullDelta(emptyDelta('2024-01-01T00:00:00.000Z'))
    expect(metaValue('lastPulledAt')).toBe('2024-06-01T00:00:00.000Z')

    await applyPullDelta(emptyDelta('2024-09-01T00:00:00.000Z'))
    expect(metaValue('lastPulledAt')).toBe('2024-09-01T00:00:00.000Z')
  })

  it('syncAll pulls after a push so a server-winning row is learned', async () => {
    const card = await seedCard(1_000)
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    pushMock.mockImplementation(async input => acceptAll(input))
    pullMock.mockResolvedValue({
      records: [remoteCard(card.id, { updatedAt: 5_000, front: 'server' })],
      watermark: '2024-06-01T00:00:00.000Z',
      more: false
    })

    setSyncUser('user-a')
    setSyncEntitlement(true)
    await syncAll('user-a')

    expect(pushMock).toHaveBeenCalledOnce()
    expect(pullMock).toHaveBeenCalledOnce()
    const stored = table(STORES.CARDS).get(card.id) as Card
    expect(stored.updatedAt).toBe(5_000)
    expect(metaValue('lastPulledAt')).toBe('2024-06-01T00:00:00.000Z')
  })

  it('syncAll keeps pulling while more is true and applies every page', async () => {
    const page1Watermark = '2024-06-01T00:00:00.000Z'
    const page2Watermark = '2024-06-02T00:00:00.000Z'
    const page3Watermark = '2024-06-03T00:00:00.000Z'
    const page1Cards = Array.from({ length: 40 }, (_, i) =>
      remoteCard(`card-p1-${i}`, { updatedAt: 1_000 + i, front: `p1-${i}` })
    )
    const page2Cards = Array.from({ length: 40 }, (_, i) =>
      remoteCard(`card-p2-${i}`, { updatedAt: 2_000 + i, front: `p2-${i}` })
    )
    const page3Cards = Array.from({ length: 20 }, (_, i) =>
      remoteCard(`card-p3-${i}`, { updatedAt: 3_000 + i, front: `p3-${i}` })
    )

    pushMock.mockResolvedValue({
      acceptedOpIds: [],
      rejected: [],
      conflicts: []
    })
    pullMock
      .mockResolvedValueOnce({
        records: [
          {
            topic: {
              id: 'topic-1',
              title: 'Imported',
              pivot: 0,
              weekJson: '[]',
              nextUpdateDate: 0,
              updatedAt: 900,
              deletedAt: null
            }
          },
          ...page1Cards
        ],
        watermark: page1Watermark,
        more: true
      })
      .mockResolvedValueOnce({
        records: page2Cards,
        watermark: page2Watermark,
        more: true
      })
      .mockResolvedValueOnce({
        records: page3Cards,
        watermark: page3Watermark,
        more: false
      })

    setSyncUser('user-a')
    setSyncEntitlement(true)
    await syncAll('user-a')

    expect(pullMock).toHaveBeenCalledTimes(3)
    expect(pullMock.mock.calls[0]![0].since).toBe(EPOCH_ISO)
    expect(pullMock.mock.calls[1]![0].since).toBe(page1Watermark)
    expect(pullMock.mock.calls[2]![0].since).toBe(page2Watermark)

    expect(table(STORES.TOPICS).get('topic-1')).toBeDefined()
    for (const page of [page1Cards, page2Cards, page3Cards]) {
      for (const record of page) {
        expect(table(STORES.CARDS).get(record.card.id)).toBeDefined()
      }
    }
    expect(table(STORES.CARDS).size).toBe(100)
    expect(metaValue('lastPulledAt')).toBe(page3Watermark)
  })
})

describe('tombstone LWW on pull', () => {
  it('keeps a local card that is newer than the remote tombstone', async () => {
    const card = await seedCard(5_000)

    await applyPullDelta({
      records: [remoteCard(card.id, { updatedAt: 3_000, deletedAt: 3_000 })],
      watermark: '2024-06-01T00:00:00.000Z',
      more: false
    })

    expect(table(STORES.CARDS).has(card.id)).toBe(true)
  })

  it('deletes a local card when the remote tombstone is newer', async () => {
    const card = await seedCard(5_000)

    await applyPullDelta({
      records: [remoteCard(card.id, { updatedAt: 6_000, deletedAt: 6_000 })],
      watermark: '2024-06-01T00:00:00.000Z',
      more: false
    })

    expect(table(STORES.CARDS).has(card.id)).toBe(false)
  })

  it('keeps a local topic that is newer than the remote tombstone', async () => {
    const topic = await seedTopic('Spanish', 5_000)

    await applyPullDelta({
      records: [
        {
          topic: {
            id: topic.id,
            title: topic.title,
            pivot: topic.pivot,
            weekJson: JSON.stringify(topic.week),
            nextUpdateDate: topic.nextUpdateDate,
            isArchived: false,
            updatedAt: 3_000,
            deletedAt: 3_000
          }
        }
      ],
      watermark: '2024-06-01T00:00:00.000Z',
      more: false
    })

    expect(table(STORES.TOPICS).has(topic.id)).toBe(true)
  })
})

describe('account isolation', () => {
  function pushedRecordIds(): string[] {
    return pushMock.mock.calls.flatMap(call =>
      (call[0].mutations as { recordId: string }[]).map(m => m.recordId)
    )
  }

  it("initialSync for user B does not enqueue or push user A's data", async () => {
    seedMeta('migratedUserId', 'user-a')
    seedMeta('lastPulledAt', '2024-06-01T00:00:00.000Z')
    const topic = await seedTopic('A topic')
    const card = await seedCard()
    await enqueueSync(STORES.TOPICS, topic.id, 'upsert')
    await enqueueSync(STORES.CARDS, card.id, 'upsert')

    bootstrapMock.mockResolvedValue(emptyDelta())
    pushMock.mockImplementation(async input => acceptAll(input))

    setSyncUser('user-b')
    setSyncEntitlement(true)
    await initialSync('user-b')

    expect(table(STORES.TOPICS).size).toBe(0)
    expect(table(STORES.CARDS).size).toBe(0)
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
    expect(pushedRecordIds()).toEqual([])
    expect(metaValue('migratedUserId')).toBe('user-b')
    // Bootstrap started from epoch, not user A's watermark.
    expect(bootstrapMock.mock.calls[0]![0].lastPulledAt).toBe(EPOCH_ISO)
    expect(bootstrapMock.mock.calls[0]![0].pendingOpCount).toBe(0)
  })

  it('initialSync migrates guest data on first sign-in (no migratedUserId)', async () => {
    const topic = await seedTopic('Guest topic')
    bootstrapMock.mockResolvedValue(emptyDelta())
    pushMock.mockImplementation(async input => acceptAll(input))

    setSyncUser('user-a')
    setSyncEntitlement(true)
    await initialSync('user-a')

    expect(pushedRecordIds()).toEqual([topic.id])
    expect(table(STORES.TOPICS).has(topic.id)).toBe(true)
    expect(metaValue('migratedUserId')).toBe('user-a')
  })

  it('sign-out clears local study data, queue and watermark', async () => {
    setSyncUser('user-a')
    seedMeta('lastPulledAt', '2024-06-01T00:00:00.000Z')
    seedMeta('migratedUserId', 'user-a')
    const topic = await seedTopic('A topic')
    const card = await seedCard()
    await enqueueSync(STORES.CARDS, card.id, 'upsert')

    setSyncUser(null)
    await vi.waitFor(() => expect(table(STORES.CARDS).size).toBe(0))

    expect(table(STORES.TOPICS).has(topic.id)).toBe(false)
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
    expect(metaValue('lastPulledAt')).toBe(EPOCH_ISO)
    expect(metaValue('migratedUserId')).toBeUndefined()
    expect(metaValue('deviceId')).toBe('device-1')
  })

  it('initial signed-out state does not wipe guest data', async () => {
    const card = await seedCard()

    setSyncUser(null)
    await Promise.resolve()

    expect(table(STORES.CARDS).has(card.id)).toBe(true)
  })

  it('clearLocalSyncData resets lastPulledAt to epoch', async () => {
    seedMeta('lastPulledAt', '2024-06-01T00:00:00.000Z')
    await clearLocalSyncData()
    expect(metaValue('lastPulledAt')).toBe(EPOCH_ISO)
  })
})

describe('syncAll concurrency', () => {
  it('a syncAll requested mid-run reruns and pushes edits made during the run', async () => {
    const first = await seedCard()
    await enqueueSync(STORES.CARDS, first.id, 'upsert')

    const pullGate = deferred<PullDelta>()
    pushMock.mockImplementation(async input => acceptAll(input))
    pullMock.mockImplementationOnce(() => pullGate.promise)
    pullMock.mockResolvedValue(emptyDelta())

    setSyncUser('user-a')
    setSyncEntitlement(true)
    const run1 = syncAll('user-a')
    await vi.waitFor(() => expect(pullMock).toHaveBeenCalledTimes(1))

    // Edit lands after the first run's push already drained the queue.
    const second = await seedCard()
    await enqueueSync(STORES.CARDS, second.id, 'upsert')
    const run2 = syncAll('user-a')

    pullGate.resolve(emptyDelta())
    await Promise.all([run1, run2])

    expect(pushMock).toHaveBeenCalledTimes(2)
    expect(pushMock.mock.calls[1]![0].mutations[0].recordId).toBe(second.id)
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
  })
})

describe('deleteCardById atomicity', () => {
  it('deletes the card and queues a delete op in one transaction', async () => {
    const card = await seedCard()
    vi.mocked(withTransaction).mockClear()

    await deleteCardById(card.id)

    expect(table(STORES.CARDS).has(card.id)).toBe(false)
    expect(queueRow(STORES.CARDS, card.id)?.operation).toBe('delete')

    const writeTxs = vi
      .mocked(withTransaction)
      .mock.calls.filter(([, mode]) => mode === 'readwrite')
    const names = writeTxs.map(([stores]) =>
      (Array.isArray(stores) ? stores : [stores]).slice().sort().join(',')
    )
    expect(names).toContain([STORES.CARDS, STORES.SYNC_QUEUE].sort().join(','))
  })
})
