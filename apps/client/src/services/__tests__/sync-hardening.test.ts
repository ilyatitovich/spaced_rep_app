import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORES } from '@/lib/db'
import { ApiError } from '@/lib/api'
import { Card } from '@/models'
import type { CardData } from '@/types'
import type { SyncRealtimeHandlers } from '@/providers/types'
import type { Mutation, PullDelta } from '@spaced-rep/sync-protocol'
import { fakeWithTransaction, memory, table } from './helpers/fake-idb'
import {
  acceptAll,
  emptyDelta,
  metaValue,
  seedMeta
} from './helpers/sync-fixtures'

const pushMock = vi.fn()
const pullMock = vi.fn()
const bootstrapMock = vi.fn()
const hydrateIncomingCardDataMock = vi.fn()
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
    hydrateIncomingCardData: hydrateIncomingCardDataMock
  })
)

vi.mock('../sync-http.client', async () =>
  (await import('./helpers/sync-mocks')).syncHttpClientModule()
)

const {
  __resetSyncServiceForTests,
  applyPullDelta,
  enqueueSync,
  getSyncState,
  initialSync,
  pushChanges,
  setSyncEntitlement,
  setSyncUser,
  syncAll
} = await import('../sync.service')
const { __resetStudyMemoryForTests, getCardFromMemory, hydrateStudyMemory } =
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

async function seedCard(updatedAt = 1_000): Promise<Card> {
  const card = new Card(textCardData('Q'), 'topic-1', 0)
  card.updatedAt = updatedAt
  table(STORES.CARDS).set(card.id, card)
  await hydrateStudyMemory()
  return card
}

function remoteCard(id: string, updatedAt: number) {
  return {
    card: {
      id,
      topicId: 'topic-1',
      level: 0,
      dataJson: JSON.stringify(textCardData('S')),
      reviewDate: null,
      updatedAt,
      deletedAt: null
    }
  }
}

function remoteTopic(id: string, weekJson: string) {
  return {
    topic: {
      id,
      title: `Topic ${id}`,
      pivot: 0,
      weekJson,
      nextUpdateDate: 0,
      isArchived: false,
      updatedAt: 5_000,
      deletedAt: null
    }
  }
}

function deltaOf(records: PullDelta['records'], watermark: string): PullDelta {
  return { records, watermark, more: false }
}

function handlers(): SyncRealtimeHandlers {
  const registered = connectRealtimeMock.mock.calls.at(-1)?.[0] as
    SyncRealtimeHandlers | undefined
  if (!registered) throw new Error('engine never called connectRealtime')
  return registered
}

function signInPro(): void {
  setSyncUser('user-a')
  setSyncEntitlement(true)
}

function setOnline(online: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
}

beforeEach(() => {
  memory.clear()
  __resetStudyMemoryForTests()
  for (const m of [
    pushMock,
    pullMock,
    bootstrapMock,
    hydrateIncomingCardDataMock,
    connectRealtimeMock,
    ...Object.values(handle)
  ]) {
    m.mockReset()
  }
  pushMock.mockImplementation(async input => acceptAll(input))
  pullMock.mockResolvedValue(emptyDelta())
  bootstrapMock.mockResolvedValue(emptyDelta())
  hydrateIncomingCardDataMock.mockImplementation(
    async (delta: PullDelta) =>
      new Map(
        delta.records
          .filter(r => r.card)
          .map(r => [r.card!.id, JSON.parse(r.card!.dataJson)])
      )
  )
  connectRealtimeMock.mockReturnValue(handle)
  handle.connect.mockResolvedValue(undefined)
  handle.isActive.mockReturnValue(false)
  handle.pushBatch.mockImplementation(async (mutations: Mutation[]) =>
    acceptAll({ mutations })
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
  seedMeta('deviceId', 'device-1')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'locks')
  __resetSyncServiceForTests()
  __resetStudyMemoryForTests()
  vi.restoreAllMocks()
})

describe('single-flight coverage', () => {
  it('a socket that turns active mid-run does not push concurrently with it', async () => {
    signInPro()
    await initialSync('user-a')
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')

    let inFlight = 0
    let maxInFlight = 0
    const gate = deferred<void>()
    pushMock.mockImplementation(async input => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await gate.promise
      inFlight--
      return acceptAll(input)
    })

    const run = syncAll('user-a')
    await vi.waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1))

    handlers().onStateChange?.('active')
    await new Promise(resolve => setTimeout(resolve, 20))
    gate.resolve()
    await run

    expect(maxInFlight).toBe(1)
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
  })

  it('a socket that turns active while idle still flushes the outbox', async () => {
    signInPro()
    await initialSync('user-a')
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    handle.isActive.mockReturnValue(true)

    handlers().onStateChange?.('active')

    await vi.waitFor(() => expect(table(STORES.SYNC_QUEUE).size).toBe(0))
    expect(handle.pushBatch).toHaveBeenCalledOnce()
  })

  it('applies deltas one at a time, so a slow WS delta cannot interleave with a pull', async () => {
    const slow = deferred<Map<string, unknown>>()
    hydrateIncomingCardDataMock.mockImplementationOnce(() => slow.promise)

    const first = applyPullDelta(deltaOf([remoteCard('card-a', 2_000)], '8'))
    const second = applyPullDelta(deltaOf([remoteCard('card-b', 2_000)], '5'))
    await new Promise(resolve => setTimeout(resolve, 20))

    // The second delta waits for the first instead of hydrating in parallel.
    expect(hydrateIncomingCardDataMock).toHaveBeenCalledTimes(1)

    slow.resolve(new Map([['card-a', textCardData('S')]]))
    await Promise.all([first, second])

    expect(hydrateIncomingCardDataMock).toHaveBeenCalledTimes(2)
    expect(getCardFromMemory('card-a')).toBeDefined()
    expect(getCardFromMemory('card-b')).toBeDefined()
    // Forward-only cursor: the older delta that finished last cannot rewind it.
    expect(metaValue('lastPulledAt')).toBe('8')
  })

  it('a failed delta does not wedge the ones queued behind it', async () => {
    hydrateIncomingCardDataMock.mockRejectedValueOnce(new Error('media down'))

    const failed = applyPullDelta(deltaOf([remoteCard('card-a', 2_000)], '5'))
    const next = applyPullDelta(deltaOf([remoteCard('card-b', 2_000)], '6'))

    await expect(failed).rejects.toThrow('media down')
    await next
    expect(getCardFromMemory('card-b')).toBeDefined()
    expect(metaValue('lastPulledAt')).toBe('6')
  })
})

describe('poison pulled records', () => {
  it('quarantines a record that cannot be decoded and still applies the rest', async () => {
    const delta = deltaOf(
      [remoteTopic('bad-topic', 'not json'), remoteCard('good-card', 2_000)],
      '20240602'
    )
    pullMock.mockResolvedValueOnce(delta)
    signInPro()

    await syncAll('user-a')

    expect(getCardFromMemory('good-card')).toBeDefined()
    expect(metaValue('lastPulledAt')).toBe('20240602')
    expect(getSyncState().status).toBe('idle')
    expect(getSyncState().failedOps).toEqual([
      expect.objectContaining({
        table: STORES.TOPICS,
        recordId: 'bad-topic',
        code: 'POISON_RECORD'
      })
    ])
    expect(JSON.parse(metaValue('failedOps') ?? '[]')).toHaveLength(1)
  })

  it('quarantines a card whose data could not be hydrated', async () => {
    hydrateIncomingCardDataMock.mockResolvedValueOnce(new Map())

    await applyPullDelta(deltaOf([remoteCard('card-x', 2_000)], '7'))

    expect(getCardFromMemory('card-x')).toBeUndefined()
    expect(metaValue('lastPulledAt')).toBe('7')
    expect(getSyncState().failedOps).toEqual([
      expect.objectContaining({
        table: STORES.CARDS,
        recordId: 'card-x',
        code: 'POISON_RECORD'
      })
    ])
  })

  it('records a record redelivered by a later pull only once', async () => {
    const delta = deltaOf([remoteTopic('bad-topic', '{')], '5')

    await applyPullDelta(delta)
    await applyPullDelta(delta)

    expect(getSyncState().failedOps).toHaveLength(1)
  })

  it('still fails the delta, and keeps the cursor, when local storage rejects a valid record', async () => {
    seedMeta('lastPulledAt', '3')
    const { withTransaction } = await import('@/lib/db')
    vi.mocked(withTransaction).mockImplementation(async (names, mode, cb) => {
      const list = (Array.isArray(names) ? names : [names]) as string[]
      if (mode === 'readwrite' && list.includes(STORES.CARDS)) {
        throw new DOMException('quota', 'QuotaExceededError')
      }
      return fakeWithTransaction(list, mode, cb as never) as never
    })

    try {
      await expect(
        applyPullDelta(deltaOf([remoteCard('card-q', 2_000)], '9'))
      ).rejects.toThrow('quota')
    } finally {
      vi.mocked(withTransaction).mockImplementation(
        fakeWithTransaction as never
      )
    }

    expect(metaValue('lastPulledAt')).toBe('3')
    expect(getSyncState().failedOps).toEqual([])
  })
})

describe('transient failure retry', () => {
  beforeEach(() => {
    // No jitter: the first retry waits exactly 2s, the second 4s.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  it.each([
    ['network failure', () => new TypeError('Failed to fetch')],
    ['HTTP 503', () => new ApiError(503, 'unavailable')],
    ['HTTP 408', () => new ApiError(408, 'timeout')]
  ])(
    'retries after a %s with backoff, then recovers',
    async (_n, makeError) => {
      vi.useFakeTimers()
      signInPro()
      pullMock.mockRejectedValueOnce(makeError())

      await syncAll('user-a')
      expect(getSyncState().status).toBe('error')
      expect(pullMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1_999)
      expect(pullMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)

      expect(pullMock).toHaveBeenCalledTimes(2)
      expect(getSyncState()).toMatchObject({ status: 'idle', lastError: null })
    }
  )

  it('doubles the delay on consecutive failures', async () => {
    vi.useFakeTimers()
    signInPro()
    pullMock
      .mockRejectedValueOnce(new ApiError(503, 'down'))
      .mockRejectedValueOnce(new ApiError(503, 'down'))

    await syncAll('user-a')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(pullMock).toHaveBeenCalledTimes(2)

    // The second delay is 4s, not another 2s.
    await vi.advanceTimersByTimeAsync(3_999)
    expect(pullMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(pullMock).toHaveBeenCalledTimes(3)
    expect(getSyncState().status).toBe('idle')
  })

  it.each([
    ['a 400', new ApiError(400, 'bad request')],
    ['a 403', new ApiError(403, 'forbidden')],
    ['a local error', new Error('boom')]
  ])('does not retry %s: waiting will not fix it', async (_n, error) => {
    vi.useFakeTimers()
    signInPro()
    pullMock.mockRejectedValueOnce(error)

    await syncAll('user-a')
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(pullMock).toHaveBeenCalledTimes(1)
    expect(getSyncState().status).toBe('error')
  })

  it('does not retry while offline; the online event owns that', async () => {
    vi.useFakeTimers()
    signInPro()
    pullMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await syncAll('user-a')

    setOnline(false)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(pullMock).toHaveBeenCalledTimes(1)
  })

  it('signing out cancels a pending retry', async () => {
    vi.useFakeTimers()
    signInPro()
    pullMock.mockRejectedValueOnce(new ApiError(503, 'down'))
    await syncAll('user-a')

    setSyncUser(null)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(pullMock).toHaveBeenCalledTimes(1)
  })

  it('a pause from an access error does not schedule a retry', async () => {
    vi.useFakeTimers()
    signInPro()
    pullMock.mockRejectedValueOnce(
      new ApiError(403, 'Pro required', 'PLAN_REQUIRED')
    )
    await syncAll('user-a')

    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(pullMock).toHaveBeenCalledTimes(1)
    expect(getSyncState().status).toBe('paused')
  })
})

describe('cross-tab coordination', () => {
  function stubLocks(
    request: (
      name: string,
      callback: () => Promise<unknown>
    ) => Promise<unknown>
  ) {
    Object.defineProperty(navigator, 'locks', {
      value: { request },
      configurable: true
    })
  }

  it('runs the sync inside a named Web Lock', async () => {
    const request = vi.fn(
      async (_name: string, callback: () => Promise<unknown>) => callback()
    )
    stubLocks(request)
    signInPro()

    await syncAll('user-a')

    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]?.[0]).toMatch(/sync/)
    expect(pullMock).toHaveBeenCalledOnce()
  })

  it("waits for another tab's sync to finish before pushing or pulling", async () => {
    const otherTab = deferred<void>()
    stubLocks(async (_name, callback) => {
      await otherTab.promise
      return callback()
    })
    signInPro()

    const run = syncAll('user-a')
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(pullMock).not.toHaveBeenCalled()

    otherTab.resolve()
    await run

    expect(pullMock).toHaveBeenCalledOnce()
  })

  it('pushes the durable row, not this tab’s stale in-memory copy', async () => {
    const card = await seedCard(1_000)
    // Another tab edited the card; this tab's memory still holds the old one.
    table(STORES.CARDS).set(card.id, { ...card, updatedAt: 5_000 })
    await enqueueSync(STORES.CARDS, card.id, 'upsert')

    await pushChanges('device-1')

    const mutation = pushMock.mock.calls[0]?.[0].mutations[0] as Mutation
    expect(mutation.updatedAt).toBe(5_000)
  })

  it('keeps an op whose record another tab created, instead of dropping it as orphaned', async () => {
    const card = new Card(textCardData('Q'), 'topic-1', 0)
    card.updatedAt = 4_000
    table(STORES.CARDS).set(card.id, card) // IDB only: this tab's memory never saw it
    await enqueueSync(STORES.CARDS, card.id, 'upsert')

    await pushChanges('device-1')

    const mutation = pushMock.mock.calls[0]?.[0].mutations[0] as Mutation
    expect(mutation).toMatchObject({ operation: 'upsert', recordId: card.id })
  })

  it('does not let an older remote overwrite a newer row another tab wrote', async () => {
    const card = await seedCard(1_000)
    table(STORES.CARDS).set(card.id, { ...card, updatedAt: 5_000 })

    await applyPullDelta(deltaOf([remoteCard(card.id, 3_000)], '4'))

    expect(
      (table(STORES.CARDS).get(card.id) as { updatedAt: number }).updatedAt
    ).toBe(5_000)
  })

  describe('study data broadcast', () => {
    interface FakeChannel {
      name: string
      postMessage: ReturnType<typeof vi.fn>
      onmessage: ((event: MessageEvent) => void) | null
      close: ReturnType<typeof vi.fn>
    }
    let channels: FakeChannel[]

    beforeEach(() => {
      channels = []
      vi.stubGlobal(
        'BroadcastChannel',
        class {
          name: string
          postMessage = vi.fn()
          onmessage: ((event: MessageEvent) => void) | null = null
          close = vi.fn()
          constructor(name: string) {
            this.name = name
            channels.push(this as unknown as FakeChannel)
          }
        }
      )
    })

    it('tells other tabs when a pull changed local data', async () => {
      setSyncUser('user-a')

      await applyPullDelta(deltaOf([remoteCard('card-b', 2_000)], '5'))

      expect(channels).toHaveLength(1)
      expect(channels[0]?.postMessage).toHaveBeenCalledOnce()
    })

    it('stays quiet when a pull changed nothing', async () => {
      setSyncUser('user-a')

      await applyPullDelta(emptyDelta('5'))

      expect(channels[0]?.postMessage).not.toHaveBeenCalled()
    })

    it('reloads memory from IndexedDB when another tab announces a change', async () => {
      setSyncUser('user-a')
      const card = new Card(textCardData('Q'), 'topic-1', 0)
      table(STORES.CARDS).set(card.id, card) // written by another tab
      expect(getCardFromMemory(card.id)).toBeUndefined()

      channels[0]?.onmessage?.({} as MessageEvent)

      await vi.waitFor(() => expect(getCardFromMemory(card.id)).toBeDefined())
    })
  })
})
