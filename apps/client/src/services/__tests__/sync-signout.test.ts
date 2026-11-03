import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORES } from '@/lib/db'
import { Card, createTopic as buildTopic, type Topic } from '@/models'
import type { CardData } from '@/types'
import type { PullDelta } from '@spaced-rep/sync-protocol'
import { memory, table } from './helpers/fake-idb'
import {
  acceptAll,
  emptyDelta,
  metaValue,
  rejectRetryable,
  seedMeta
} from './helpers/sync-fixtures'

const pushMock = vi.fn()
const pullMock = vi.fn()
const bootstrapMock = vi.fn()
const connectRealtimeMock = vi.fn()

const handle = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  isActive: vi.fn(),
  pushBatch: vi.fn(),
  updateResume: vi.fn()
}

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
    bootstrap: bootstrapMock,
    connectRealtime: connectRealtimeMock
  })
)

vi.mock('@/lib/sync-media', async () =>
  (await import('./helpers/sync-mocks')).syncMediaModule({
    uploadOwnedMedia: vi.fn(),
    hydrateIncomingCardData: vi.fn(async () => new Map())
  })
)

vi.mock('../sync-http.client', async () =>
  (await import('./helpers/sync-mocks')).syncHttpClientModule()
)

const {
  __resetSyncServiceForTests,
  enqueueSync,
  flushPendingChanges,
  initialSync,
  setSyncEntitlement,
  setSyncUser,
  syncAll
} = await import('../sync.service')
const { __resetStudyMemoryForTests, hydrateStudyMemory } =
  await import('../study-memory')

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

function textCardData(front: string): CardData {
  return {
    front: {
      side: 'front',
      blocks: [{ type: 'text', html: `<p>${front}</p>` }]
    },
    back: { side: 'back', blocks: [{ type: 'text', html: '<p>A</p>' }] }
  }
}

async function seedCard(): Promise<Card> {
  const card = new Card(textCardData('Q'), 'topic-1', 0)
  card.updatedAt = 1_000
  table(STORES.CARDS).set(card.id, card)
  await hydrateStudyMemory()
  return card
}

async function seedTopic(title: string): Promise<Topic> {
  const topic = buildTopic(title)
  topic.updatedAt = 1_000
  table(STORES.TOPICS).set(topic.id, topic)
  await hydrateStudyMemory()
  return topic
}

function remoteTopicDelta(id: string): PullDelta {
  return {
    records: [
      {
        topic: {
          id,
          title: 'Account A remote topic',
          pivot: 0,
          weekJson: '[]',
          nextUpdateDate: 0,
          isArchived: false,
          updatedAt: 5_000,
          deletedAt: null
        }
      }
    ],
    watermark: '2024-06-01T00:00:00.000Z',
    more: false
  }
}

function pushedRecordIds(): string[] {
  return pushMock.mock.calls.flatMap(call =>
    (call[0].mutations as { recordId: string }[]).map(m => m.recordId)
  )
}

function setOnline(online: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
}

function signIn(userId: string, entitled = true): void {
  setSyncUser(userId)
  setSyncEntitlement(entitled)
}

beforeEach(() => {
  memory.clear()
  __resetStudyMemoryForTests()
  for (const m of [
    pushMock,
    pullMock,
    bootstrapMock,
    connectRealtimeMock,
    ...Object.values(handle)
  ]) {
    m.mockReset()
  }
  pushMock.mockImplementation(async input => acceptAll(input))
  pullMock.mockResolvedValue(emptyDelta())
  bootstrapMock.mockResolvedValue(emptyDelta())
  connectRealtimeMock.mockReturnValue(handle)
  handle.connect.mockResolvedValue(undefined)
  handle.isActive.mockReturnValue(false)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  seedMeta('deviceId', 'device-1')
})

afterEach(() => {
  __resetSyncServiceForTests()
  __resetStudyMemoryForTests()
  vi.restoreAllMocks()
})

describe('sign-out while a sync is in flight', () => {
  it('waits for the run and wipes afterwards, so a late pull cannot leave account A rows behind', async () => {
    seedMeta('migratedUserId', 'user-a')
    signIn('user-a')
    const pullGate = deferred<PullDelta>()
    pullMock.mockImplementationOnce(() => pullGate.promise)
    const run = syncAll('user-a')
    await vi.waitFor(() => expect(pullMock).toHaveBeenCalledTimes(1))

    setSyncUser(null)
    pullGate.resolve(remoteTopicDelta('late-topic'))
    await run

    await vi.waitFor(() => expect(metaValue('migratedUserId')).toBeUndefined())
    expect(table(STORES.TOPICS).size).toBe(0)
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
  })

  it('does not wipe while the run is still in flight', async () => {
    signIn('user-a')
    const topic = await seedTopic('A topic')
    const pullGate = deferred<PullDelta>()
    pullMock.mockImplementationOnce(() => pullGate.promise)
    const run = syncAll('user-a')
    await vi.waitFor(() => expect(pullMock).toHaveBeenCalledTimes(1))

    setSyncUser(null)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(table(STORES.TOPICS).has(topic.id)).toBe(true)

    pullGate.resolve(emptyDelta())
    await run
    await vi.waitFor(() => expect(table(STORES.TOPICS).size).toBe(0))
  })

  it('does not start another pass after sign-out', async () => {
    signIn('user-a')
    const pullGate = deferred<PullDelta>()
    pullMock.mockImplementationOnce(() => pullGate.promise)
    const run = syncAll('user-a')
    await vi.waitFor(() => expect(pullMock).toHaveBeenCalledTimes(1))
    void syncAll('user-a') // queues a rerun

    setSyncUser(null)
    pullGate.resolve(emptyDelta())
    await run

    expect(pullMock).toHaveBeenCalledTimes(1)
  })
})

describe('account switch without a sign-out in between', () => {
  it('never uploads account A pending edits as account B', async () => {
    seedMeta('migratedUserId', 'user-a')
    signIn('user-a')
    const topic = await seedTopic('A topic')
    const card = await seedCard()
    await enqueueSync(STORES.TOPICS, topic.id, 'upsert')
    await enqueueSync(STORES.CARDS, card.id, 'upsert')

    signIn('user-b')
    await initialSync('user-b')

    expect(pushedRecordIds()).toEqual([])
    expect(table(STORES.TOPICS).size).toBe(0)
    expect(table(STORES.CARDS).size).toBe(0)
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
    expect(metaValue('migratedUserId')).toBe('user-b')
  })

  it('initialSync for B waits for A in-flight sync instead of being swallowed by it', async () => {
    seedMeta('migratedUserId', 'user-a')
    signIn('user-a')
    await seedTopic('A topic')
    const pullGate = deferred<PullDelta>()
    pullMock.mockImplementationOnce(() => pullGate.promise)
    const runA = syncAll('user-a')
    await vi.waitFor(() => expect(pullMock).toHaveBeenCalledTimes(1))

    signIn('user-b')
    const initialB = initialSync('user-b')
    pullGate.resolve(emptyDelta())
    await Promise.all([runA, initialB])

    expect(bootstrapMock).toHaveBeenCalledTimes(1)
    expect(table(STORES.TOPICS).size).toBe(0)
    expect(metaValue('migratedUserId')).toBe('user-b')
  })

  it('disconnects the realtime socket when the user changes', async () => {
    signIn('user-a')
    await initialSync('user-a')
    handle.disconnect.mockClear()

    setSyncUser('user-b')

    expect(handle.disconnect).toHaveBeenCalled()
  })
})

describe('flushPendingChanges (called before signing out)', () => {
  it('pushes the outbox and reports nothing left behind', async () => {
    const card = await seedCard()
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    signIn('user-a')

    const remaining = await flushPendingChanges()

    expect(pushedRecordIds()).toEqual([card.id])
    expect(remaining).toBe(0)
  })

  it('waits for a sync that is already running', async () => {
    const card = await seedCard()
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    signIn('user-a')
    const pullGate = deferred<PullDelta>()
    pullMock.mockImplementationOnce(() => pullGate.promise)
    void syncAll('user-a')
    await vi.waitFor(() => expect(pullMock).toHaveBeenCalledTimes(1))

    let settled = false
    const flush = flushPendingChanges().then(count => {
      settled = true
      return count
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(settled).toBe(false)

    pullGate.resolve(emptyDelta())
    expect(await flush).toBe(0)
  })

  it('reports the unsynced count while offline without touching the network', async () => {
    setOnline(false)
    const card = await seedCard()
    const topic = await seedTopic('T')
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    await enqueueSync(STORES.TOPICS, topic.id, 'upsert')
    signIn('user-a')

    expect(await flushPendingChanges()).toBe(2)
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('reports the unsynced count when the account cannot sync (not Pro)', async () => {
    const card = await seedCard()
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    signIn('user-a', false)

    expect(await flushPendingChanges()).toBe(1)
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('reports the unsynced count when the push is rejected', async () => {
    const card = await seedCard()
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    signIn('user-a')
    pushMock.mockImplementation(async input => rejectRetryable(input))

    expect(await flushPendingChanges()).toBe(1)
  })

  it('gives up after the timeout instead of hanging the sign-out', async () => {
    const card = await seedCard()
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
    signIn('user-a')
    pushMock.mockImplementation(() => new Promise(() => {}))

    expect(await flushPendingChanges(30)).toBe(1)
  })

  it('reports 0 when there is nothing queued, even if sync is unavailable', async () => {
    signIn('user-a', false)

    expect(await flushPendingChanges()).toBe(0)
  })
})
