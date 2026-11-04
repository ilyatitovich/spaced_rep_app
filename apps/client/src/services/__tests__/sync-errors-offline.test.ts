import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORES } from '@/lib/db'
import { ApiError } from '@/lib/api'
import { memory, table } from './helpers/fake-idb'
import {
  acceptAll,
  emptyDelta,
  metaValue,
  rejectAll,
  seedMeta
} from './helpers/sync-fixtures'

const pushMock = vi.fn()
const pullMock = vi.fn()
const bootstrapMock = vi.fn()

vi.mock('@/lib/db', async () =>
  (await import('./helpers/fake-idb')).fakeDbModule()
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
  enqueueSyncBulk,
  getSyncState,
  initialSync,
  pushChanges,
  reconnectRevokedDevice,
  setSyncEntitlement,
  setSyncUser,
  syncAll,
  syncNow,
  triggerSync
} = await import('../sync.service')
const { __resetStudyMemoryForTests } = await import('../study-memory')

const TRIGGER_DEBOUNCE_MS = 1500

/** A queued delete needs no local record, so the outbox can be seeded directly. */
function seedQueueRow(recordId: string, attempts = 0, nextRetryAt = 0): void {
  table(STORES.SYNC_QUEUE).set(`cards:${recordId}`, {
    id: `cards:${recordId}`,
    opId: `op-${recordId}`,
    table: STORES.CARDS,
    recordId,
    operation: 'delete',
    createdAt: 1,
    attempts,
    nextRetryAt
  })
}

function queueRow(recordId: string) {
  return table(STORES.SYNC_QUEUE).get(`cards:${recordId}`) as
    { attempts: number; nextRetryAt: number } | undefined
}

function pushBatchSizes(): number[] {
  return pushMock.mock.calls.map(
    ([input]) => (input as { mutations: unknown[] }).mutations.length
  )
}

function pushedOpIds(): string[][] {
  return pushMock.mock.calls.map(([input]) =>
    (input as { mutations: { opId: string }[] }).mutations.map(m => m.opId)
  )
}

function setOnline(online: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
}

function signInPro(): void {
  setSyncUser('user-a')
  setSyncEntitlement(true)
}

beforeEach(() => {
  memory.clear()
  __resetStudyMemoryForTests()
  for (const m of [pushMock, pullMock, bootstrapMock]) m.mockReset()
  pushMock.mockImplementation(async input => acceptAll(input))
  pullMock.mockResolvedValue(emptyDelta())
  bootstrapMock.mockResolvedValue(emptyDelta())
  vi.spyOn(console, 'error').mockImplementation(() => {})
  seedMeta('deviceId', 'device-1')
})

afterEach(() => {
  vi.useRealTimers()
  __resetSyncServiceForTests()
  __resetStudyMemoryForTests()
  vi.restoreAllMocks()
})

describe('offline gating and online flush', () => {
  it('syncAll while offline reports offline, touches no network and keeps the queue', async () => {
    setOnline(false)
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    signInPro()

    await syncAll('user-a')

    expect(getSyncState()).toMatchObject({
      status: 'offline',
      connection: 'offline',
      queueDepth: 1
    })
    expect(pushMock).not.toHaveBeenCalled()
    expect(pullMock).not.toHaveBeenCalled()
    expect(queueRow('card-1')).toBeDefined()
  })

  it('triggerSync is a no-op offline; once online, rapid triggers debounce into one flush', async () => {
    vi.useFakeTimers()
    setOnline(false)
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    signInPro()

    triggerSync()
    await vi.advanceTimersByTimeAsync(TRIGGER_DEBOUNCE_MS * 2)
    expect(pushMock).not.toHaveBeenCalled()

    setOnline(true)
    triggerSync()
    triggerSync()
    await vi.advanceTimersByTimeAsync(TRIGGER_DEBOUNCE_MS - 1)
    expect(pushMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await vi.waitFor(() => expect(getSyncState().status).toBe('idle'))

    expect(pushMock).toHaveBeenCalledOnce()
    expect(pullMock).toHaveBeenCalledOnce()
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
    expect(getSyncState().queueDepth).toBe(0)
  })
})

describe('network failure', () => {
  it('a push that throws sets error, keeps the queue and releases the mutex', async () => {
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    signInPro()
    pushMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await syncAll('user-a')

    expect(getSyncState()).toMatchObject({
      status: 'error',
      lastError: 'Failed to fetch'
    })
    expect(queueRow('card-1')).toBeDefined()
    expect(pullMock).not.toHaveBeenCalled()

    // Mutex released: the next run actually executes and drains the outbox.
    await syncAll('user-a')

    expect(pushMock).toHaveBeenCalledTimes(2)
    expect(getSyncState()).toMatchObject({
      status: 'idle',
      lastError: null,
      queueDepth: 0
    })
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
  })

  it('a pull that throws sets error, keeps the watermark and releases the mutex', async () => {
    seedMeta('lastPulledAt', '20240101')
    signInPro()
    pullMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await syncAll('user-a')

    expect(getSyncState().status).toBe('error')
    expect(metaValue('lastPulledAt')).toBe('20240101')

    await syncAll('user-a')

    expect(pullMock).toHaveBeenCalledTimes(2)
    expect(getSyncState().status).toBe('idle')
    expect(metaValue('lastPulledAt')).toBe('20240601')
  })
})

describe('RATE_LIMITED backoff', () => {
  it.each([
    ['RATE_LIMITED code', new ApiError(400, 'slow down', 'RATE_LIMITED')],
    ['HTTP 429 status', new ApiError(429, 'slow down')]
  ])(
    'retries the same batch after a delay on %s without surfacing an error',
    async (_name, error) => {
      vi.useFakeTimers()
      await enqueueSync(STORES.CARDS, 'card-1', 'delete')
      signInPro()
      pushMock.mockRejectedValueOnce(error)

      const run = syncAll('user-a')

      await vi.advanceTimersByTimeAsync(1_999)
      expect(pushMock).toHaveBeenCalledTimes(1)
      expect(getSyncState().status).toBe('syncing')

      await vi.advanceTimersByTimeAsync(1)
      await run

      expect(pushMock).toHaveBeenCalledTimes(2)
      // Same op replayed (idempotent on the server), not a fresh one.
      expect(pushedOpIds()[1]).toEqual(pushedOpIds()[0])
      expect(getSyncState()).toMatchObject({ status: 'idle', lastError: null })
      expect(table(STORES.SYNC_QUEUE).size).toBe(0)
    }
  )

  it('doubles the delay on consecutive rate limits', async () => {
    vi.useFakeTimers()
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    signInPro()
    pushMock
      .mockRejectedValueOnce(new ApiError(429, 'slow down'))
      .mockRejectedValueOnce(new ApiError(429, 'slow down'))

    const run = syncAll('user-a')

    await vi.advanceTimersByTimeAsync(2_000)
    expect(pushMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(3_999)
    expect(pushMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    await run

    expect(pushMock).toHaveBeenCalledTimes(3)
    expect(getSyncState().status).toBe('idle')
  })
})

describe('access state machine', () => {
  it.each([
    ['DEVICE_REVOKED', 'revoked', 'This device was disconnected from sync'],
    ['DEVICE_LIMIT', 'paused', 'device limit reached'],
    ['PLAN_REQUIRED', 'paused', 'plan required'],
    [
      'PROTOCOL_MISMATCH',
      'update_required',
      'Update the app to continue syncing'
    ]
  ])('push %s -> %s, keeps the outbox', async (code, status, lastError) => {
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    signInPro()
    pushMock.mockRejectedValueOnce(new ApiError(403, lastError, code))

    await syncAll('user-a')

    expect(getSyncState()).toMatchObject({
      status,
      connection: 'idle',
      lastError
    })
    expect(queueRow('card-1')).toBeDefined()
    expect(pullMock).not.toHaveBeenCalled()
  })

  it('initialSync maps a bootstrap access error to the same state', async () => {
    signInPro()
    bootstrapMock.mockRejectedValueOnce(
      new ApiError(403, 'Pro required', 'PLAN_REQUIRED')
    )

    await initialSync('user-a')

    expect(getSyncState()).toMatchObject({
      status: 'paused',
      lastError: 'Pro required'
    })
  })

  it('update_required stops syncNow, triggerSync and syncAll', async () => {
    vi.useFakeTimers()
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    signInPro()
    pushMock.mockRejectedValueOnce(
      new ApiError(426, 'old client', 'PROTOCOL_MISMATCH')
    )
    await syncAll('user-a')
    pushMock.mockClear()

    syncNow()
    triggerSync()
    await vi.advanceTimersByTimeAsync(TRIGGER_DEBOUNCE_MS * 2)
    await syncAll('user-a')

    expect(pushMock).not.toHaveBeenCalled()
    expect(getSyncState().status).toBe('update_required')
  })

  it('a revoked device refuses syncNow/triggerSync', async () => {
    vi.useFakeTimers()
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    signInPro()
    pushMock.mockRejectedValueOnce(
      new ApiError(403, 'revoked', 'DEVICE_REVOKED')
    )
    await syncAll('user-a')
    pushMock.mockClear()

    syncNow()
    triggerSync()
    await vi.advanceTimersByTimeAsync(TRIGGER_DEBOUNCE_MS * 2)

    expect(pushMock).not.toHaveBeenCalled()
    expect(getSyncState().status).toBe('revoked')
  })

  it('reconnectRevokedDevice mints a new deviceId, bootstraps with it and drains the outbox', async () => {
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    signInPro()
    pushMock.mockRejectedValueOnce(
      new ApiError(403, 'revoked', 'DEVICE_REVOKED')
    )
    await syncAll('user-a')
    expect(getSyncState().status).toBe('revoked')

    await reconnectRevokedDevice()

    const newDeviceId = metaValue('deviceId')
    expect(newDeviceId).toBeDefined()
    expect(newDeviceId).not.toBe('device-1')
    expect(bootstrapMock.mock.calls[0]?.[0]).toMatchObject({
      deviceId: newDeviceId,
      pendingOpCount: 1
    })
    expect(pushMock.mock.calls.at(-1)?.[0]).toMatchObject({
      deviceId: newDeviceId
    })
    expect(getSyncState()).toMatchObject({
      status: 'idle',
      deviceId: newDeviceId,
      lastError: null,
      queueDepth: 0
    })
  })

  it('reconnectRevokedDevice that hits DEVICE_LIMIT ends paused, not error', async () => {
    signInPro()
    bootstrapMock.mockRejectedValueOnce(
      new ApiError(403, 'Device limit reached', 'DEVICE_LIMIT')
    )

    await reconnectRevokedDevice()

    expect(getSyncState()).toMatchObject({
      status: 'paused',
      lastError: 'Device limit reached'
    })
  })

  it('entitlement loss pauses sync; regaining it resumes and syncs again', async () => {
    await enqueueSync(STORES.CARDS, 'card-1', 'delete')
    setSyncUser('user-a')
    expect(setSyncEntitlement(true)).toBe(true)

    expect(setSyncEntitlement(false)).toBe(false)
    expect(getSyncState().status).toBe('paused')
    await syncAll('user-a')
    expect(pushMock).not.toHaveBeenCalled()

    expect(setSyncEntitlement(true)).toBe(true)
    expect(getSyncState()).toMatchObject({ status: 'idle', lastError: null })
    await syncAll('user-a')

    expect(pushMock).toHaveBeenCalledOnce()
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
  })
})

describe('outbox retry and failedOps', () => {
  it('a retryable reject bumps attempts, schedules a backoff and is not re-pushed early', async () => {
    seedQueueRow('card-1', 1)
    pushMock.mockImplementation(async input =>
      rejectAll(input, { code: 'TRANSIENT', retryable: true })
    )

    await pushChanges('device-1')

    expect(pushMock).toHaveBeenCalledOnce()
    expect(queueRow('card-1')?.attempts).toBe(2)
    expect(queueRow('card-1')?.nextRetryAt).toBeGreaterThan(Date.now())
    expect(getSyncState().failedOps).toEqual([])

    await pushChanges('device-1')
    expect(pushMock).toHaveBeenCalledOnce()
  })

  it('pushes the row again once its backoff has elapsed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    seedQueueRow('card-1', 1, Date.now() + 60_000)

    await pushChanges('device-1')
    expect(pushMock).not.toHaveBeenCalled()

    vi.setSystemTime(Date.now() + 60_001)
    await pushChanges('device-1')

    expect(pushMock).toHaveBeenCalledOnce()
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
  })

  it('a non-retryable reject moves the op to failedOps and drops it from the queue', async () => {
    seedQueueRow('card-1')
    pushMock.mockImplementation(async input =>
      rejectAll(input, { code: 'VALIDATION', retryable: false })
    )

    await pushChanges('device-1')

    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
    const expected = [
      expect.objectContaining({
        opId: 'op-card-1',
        table: STORES.CARDS,
        recordId: 'card-1',
        code: 'VALIDATION',
        message: 'rejected: VALIDATION'
      })
    ]
    expect(getSyncState().failedOps).toEqual(expected)
    expect(JSON.parse(metaValue('failedOps') ?? '[]')).toEqual(expected)
  })

  it('a retryable reject on the final attempt is failed instead of retried forever', async () => {
    seedQueueRow('card-1', 9)
    seedQueueRow('card-2', 8)
    pushMock.mockImplementation(async input =>
      rejectAll(input, { code: 'TRANSIENT', retryable: true })
    )

    await pushChanges('device-1')

    expect(getSyncState().failedOps.map(op => op.recordId)).toEqual(['card-1'])
    expect(queueRow('card-1')).toBeUndefined()
    expect(queueRow('card-2')?.attempts).toBe(9)
  })

  it('drains a queue larger than one batch in 50-op pushes', async () => {
    await enqueueSyncBulk(
      Array.from({ length: 120 }, (_, i) => ({
        table: STORES.CARDS,
        recordId: `card-${i}`,
        operation: 'delete' as const
      }))
    )

    await pushChanges('device-1')

    expect(pushBatchSizes()).toEqual([50, 50, 20])
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
  })
})
