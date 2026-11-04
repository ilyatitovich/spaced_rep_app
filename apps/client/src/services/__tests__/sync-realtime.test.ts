import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORES } from '@/lib/db'
import { createTopic as buildTopic, type Topic } from '@/models'
import type { SyncRealtimeHandlers } from '@/providers/types'
import type { Mutation, PullDelta } from '@spaced-rep/sync-protocol'
import { memory, table } from './helpers/fake-idb'
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

/** The realtime handle the engine drives; the tests play the WS manager. */
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
  enqueueSync,
  getSyncState,
  initialSync,
  pushChanges,
  setSyncEntitlement,
  setSyncUser,
  syncAll
} = await import('../sync.service')
const { __resetStudyMemoryForTests, hydrateStudyMemory } =
  await import('../study-memory')

const BOOTSTRAP_WATERMARK = '20240601'

/** Handlers the engine registered with `connectRealtime`. */
function handlers(): SyncRealtimeHandlers {
  const registered = connectRealtimeMock.mock.calls.at(-1)?.[0] as
    SyncRealtimeHandlers | undefined
  if (!registered) throw new Error('engine never called connectRealtime')
  return registered
}

function topicDelta(id: string, title: string, watermark: string): PullDelta {
  return {
    records: [
      {
        topic: {
          id,
          title,
          pivot: 0,
          weekJson: '[]',
          nextUpdateDate: 0,
          updatedAt: 5_000,
          deletedAt: null
        }
      }
    ],
    watermark,
    more: false
  }
}

function queueSize(): number {
  return table(STORES.SYNC_QUEUE).size
}

function wsPushedOpIds(): string[] {
  const mutations = handle.pushBatch.mock.calls[0]?.[0] as
    Mutation[] | undefined
  return (mutations ?? []).map(m => m.opId)
}

function httpPushedOpIds(): string[] {
  const input = pushMock.mock.calls[0]?.[0] as
    { mutations: { opId: string }[] } | undefined
  return (input?.mutations ?? []).map(m => m.opId)
}

/** Signed-in Pro user whose initial sync has wired up the realtime handle. */
async function startRealtime(): Promise<void> {
  setSyncUser('user-a')
  setSyncEntitlement(true)
  bootstrapMock.mockResolvedValue(emptyDelta(BOOTSTRAP_WATERMARK))
  await initialSync('user-a')
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
  hydrateIncomingCardDataMock.mockResolvedValue(new Map())
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
  __resetSyncServiceForTests()
  __resetStudyMemoryForTests()
  vi.restoreAllMocks()
})

describe('realtime connection', () => {
  it('initialSync wires the handle and connects with the device resume state', async () => {
    await startRealtime()

    expect(connectRealtimeMock).toHaveBeenCalledOnce()
    expect(handle.updateResume).toHaveBeenCalledWith(BOOTSTRAP_WATERMARK, 0)
    expect(handle.connect).toHaveBeenCalledWith({
      deviceId: 'device-1',
      lastPulledAt: BOOTSTRAP_WATERMARK,
      pendingOpCount: 0
    })
  })

  it('syncAll reconnects an inactive socket but leaves an active one alone', async () => {
    await startRealtime()
    expect(handle.connect).toHaveBeenCalledTimes(1)

    await syncAll('user-a')
    expect(handle.connect).toHaveBeenCalledTimes(2)

    handle.isActive.mockReturnValue(true)
    await syncAll('user-a')
    expect(handle.connect).toHaveBeenCalledTimes(2)
  })

  it('a socket that turns active flushes the outbox and reports the ws connection', async () => {
    await startRealtime()
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    handle.isActive.mockReturnValue(true)

    handlers().onStateChange?.('active')

    await vi.waitFor(() => expect(queueSize()).toBe(0))
    expect(handle.pushBatch).toHaveBeenCalledOnce()
    expect(pushMock).not.toHaveBeenCalled()
    expect(getSyncState().connection).toBe('ws')
  })

  it('a dropped socket moves the connection back to idle', async () => {
    await startRealtime()
    handlers().onStateChange?.('active')
    await vi.waitFor(() => expect(getSyncState().connection).toBe('ws'))

    handlers().onStateChange?.('disconnected')

    expect(getSyncState().connection).toBe('idle')
  })
})

describe('push over realtime with HTTP fallback', () => {
  it('pushes over the socket when it is active and skips HTTP', async () => {
    await startRealtime()
    handle.isActive.mockReturnValue(true)
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')

    await pushChanges('device-1')

    expect(handle.pushBatch).toHaveBeenCalledOnce()
    expect(pushMock).not.toHaveBeenCalled()
    expect(getSyncState().connection).toBe('ws')
    expect(queueSize()).toBe(0)
  })

  it('pushes over HTTP when the socket is not active', async () => {
    await startRealtime()
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')

    await pushChanges('device-1')

    expect(handle.pushBatch).not.toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledOnce()
    expect(getSyncState().connection).toBe('http')
    expect(queueSize()).toBe(0)
  })

  it('falls back to HTTP with the same opIds when the socket push fails, and keeps nothing stranded', async () => {
    await startRealtime()
    handle.isActive.mockReturnValue(true)
    handle.pushBatch.mockRejectedValueOnce(new Error('PushAck timeout'))
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    await enqueueSync(STORES.CARDS, 'card-2', 'delete')

    await pushChanges('device-1')

    expect(handle.pushBatch).toHaveBeenCalledOnce()
    expect(pushMock).toHaveBeenCalledOnce()
    // Same ops replayed: the server's idempotency table dedupes a late WS ack.
    expect(httpPushedOpIds()).toHaveLength(2)
    expect(httpPushedOpIds()).toEqual(wsPushedOpIds())
    expect(getSyncState().connection).toBe('http')
    expect(queueSize()).toBe(0)
  })

  it('applies a rejected op from a socket ack like an HTTP ack (retryable keeps it, fatal moves it to failedOps)', async () => {
    await startRealtime()
    handle.isActive.mockReturnValue(true)
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    await enqueueSync(STORES.CARDS, 'card-2', 'delete')
    handle.pushBatch.mockImplementationOnce(async (mutations: Mutation[]) => ({
      acceptedOpIds: [],
      rejected: [
        {
          opId: mutations[0]?.opId ?? '',
          code: 'TRANSIENT',
          retryable: true,
          message: 'later'
        },
        {
          opId: mutations[1]?.opId ?? '',
          code: 'INVALID',
          retryable: false,
          message: 'bad'
        }
      ],
      conflicts: []
    }))

    await pushChanges('device-1')

    expect(queueSize()).toBe(1)
    expect(getSyncState().failedOps).toHaveLength(1)
    expect(getSyncState().failedOps[0]?.code).toBe('INVALID')
  })
})

describe('onDelta', () => {
  it('applies a pushed delta and advances the watermark', async () => {
    await startRealtime()
    const delta = topicDelta('topic-ws', 'From peer', '20240701')

    handlers().onDelta(delta)

    await vi.waitFor(() =>
      expect(table(STORES.TOPICS).get('topic-ws')).toBeDefined()
    )
    expect(metaValue('lastPulledAt')).toBe('20240701')
    expect(pullMock).not.toHaveBeenCalled()
  })

  it('recovers a failed apply with an HTTP pull from the old watermark', async () => {
    await startRealtime()
    hydrateIncomingCardDataMock.mockRejectedValueOnce(
      new Error('hydrate failed')
    )
    pullMock.mockResolvedValueOnce(
      topicDelta('topic-ws', 'From peer', '20240701')
    )

    handlers().onDelta(topicDelta('topic-ws', 'From peer', '20240801'))

    await vi.waitFor(() =>
      expect(table(STORES.TOPICS).get('topic-ws')).toBeDefined()
    )
    // The failed delta must not have moved the cursor, or the pull would skip its range.
    expect(pullMock).toHaveBeenCalledWith({
      deviceId: 'device-1',
      since: BOOTSTRAP_WATERMARK
    })
    expect(metaValue('lastPulledAt')).toBe('20240701')
    expect(console.error).toHaveBeenCalledWith(
      'WS delta apply failed:',
      expect.any(Error)
    )
  })

  it('a failing recovery sync is logged, keeps the watermark and does not break the engine', async () => {
    await startRealtime()
    hydrateIncomingCardDataMock.mockRejectedValueOnce(
      new Error('hydrate failed')
    )
    pullMock.mockRejectedValueOnce(new Error('offline'))

    handlers().onDelta(topicDelta('topic-ws', 'From peer', '20240801'))

    await vi.waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Sync failed:',
        expect.any(Error)
      )
    )
    expect(getSyncState().status).toBe('error')
    expect(metaValue('lastPulledAt')).toBe(BOOTSTRAP_WATERMARK)
    expect(table(STORES.TOPICS).size).toBe(0)

    // Next normal sync still works and picks the range up.
    pullMock.mockResolvedValueOnce(
      topicDelta('topic-ws', 'From peer', '20240801')
    )
    await syncAll('user-a')
    expect(table(STORES.TOPICS).get('topic-ws')).toBeDefined()
    expect(getSyncState().status).toBe('idle')
  })
})

describe('onConflict', () => {
  it('renames the local topic to the server-chosen title', async () => {
    await startRealtime()
    const topic = buildTopic('Biology')
    topic.updatedAt = 1_000
    table(STORES.TOPICS).set(topic.id, topic)
    await hydrateStudyMemory()

    handlers().onConflict({
      topicId: topic.id,
      oldTitle: 'Biology',
      newTitle: 'Biology (2)',
      reason: 'duplicate_title',
      updatedAt: 9_000
    })

    await vi.waitFor(() =>
      expect((table(STORES.TOPICS).get(topic.id) as Topic).title).toBe(
        'Biology (2)'
      )
    )
    expect((table(STORES.TOPICS).get(topic.id) as Topic).updatedAt).toBe(9_000)
  })
})

describe('access callbacks from the socket', () => {
  it.each([
    ['onPlanRequired', 'paused', 'Upgrade to Pro to sync'],
    ['onDeviceRevoked', 'revoked', 'This device was disconnected from sync'],
    [
      'onProtocolMismatch',
      'update_required',
      'Update the app to continue syncing'
    ]
  ] as const)(
    '%s -> %s and the socket is released',
    async (name, status, lastError) => {
      await startRealtime()

      handlers()[name]?.()

      expect(getSyncState()).toMatchObject({
        status,
        connection: 'idle',
        lastError
      })
      expect(handle.disconnect).toHaveBeenCalled()
    }
  )

  it('onTokenExpired drops the socket and reconnects with the stored resume state', async () => {
    await startRealtime()
    handle.connect.mockClear()

    handlers().onTokenExpired?.()

    await vi.waitFor(() => expect(handle.connect).toHaveBeenCalledOnce())
    expect(handle.disconnect).toHaveBeenCalled()
    expect(handle.connect).toHaveBeenCalledWith({
      deviceId: 'device-1',
      lastPulledAt: BOOTSTRAP_WATERMARK,
      pendingOpCount: 0
    })
  })
})
