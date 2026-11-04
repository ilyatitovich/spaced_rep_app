import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_CURSOR_LENGTH,
  MAX_PUSH_MUTATIONS,
  PROTOCOL_VERSION
} from '@spaced-rep/sync-protocol'

const assertPlan = vi.fn()
vi.mock('../../settings/services/plan.service.js', () => ({ assertPlan }))
vi.mock('../../shared/lib/redis.js', () => ({
  enforceRateLimit: vi.fn()
}))

const applyPushBatch = vi.fn()
const pullChanges = vi.fn()
const bootstrap = vi.fn()
const reportDevice = vi.fn()
vi.mock('../sync.service.js', () => ({
  applyPushBatch,
  bootstrap,
  finishSyncCycle: vi.fn(),
  listSyncDevices: vi.fn(),
  pullChanges,
  reportDevice,
  revokeSyncDevice: vi.fn()
}))
vi.mock('../ws.handler.js', () => ({
  disconnectSyncDevice: vi.fn()
}))

const { bootstrapHandler, pullHandler, pushHandler } =
  await import('./sync.handler.js')

describe('sync HTTP entitlement', () => {
  it.each([
    ['push', pushHandler, applyPushBatch],
    ['pull', pullHandler, pullChanges]
  ])(
    'blocks %s before accessing cloud data',
    async (_name, handler, service) => {
      const error = Object.assign(new Error('Pro required'), {
        code: 'PLAN_REQUIRED'
      })
      assertPlan.mockRejectedValueOnce(error)
      const next = vi.fn()

      await handler({ auth: { userId: 'user-1' } } as never, {} as never, next)

      expect(next).toHaveBeenCalledWith(error)
      expect(service).not.toHaveBeenCalled()
    }
  )

  it('registers the pushing device before applying cloud mutations', async () => {
    assertPlan.mockResolvedValueOnce(undefined)
    reportDevice.mockResolvedValueOnce(undefined)
    applyPushBatch.mockResolvedValueOnce({
      acceptedOpIds: [],
      rejected: [],
      conflicts: []
    })
    const res = { status: vi.fn(), json: vi.fn() }
    res.status.mockReturnValue(res)

    await pushHandler(
      {
        auth: { userId: 'user-1' },
        body: {
          version: PROTOCOL_VERSION,
          messageId: 'message-1',
          deviceId: '11111111-1111-4111-8111-111111111111',
          sentAt: Date.now(),
          kind: 'pushBatch',
          pushBatch: { mutations: [] }
        },
        get: vi.fn().mockReturnValue('test-agent')
      } as never,
      res as never,
      vi.fn()
    )

    expect(reportDevice).toHaveBeenCalledWith({
      userId: 'user-1',
      deviceId: '11111111-1111-4111-8111-111111111111',
      userAgent: 'test-agent'
    })
    const reportedAt = reportDevice.mock.invocationCallOrder[0]
    const appliedAt = applyPushBatch.mock.invocationCallOrder[0]
    expect(reportedAt).toBeDefined()
    expect(appliedAt).toBeDefined()
    expect(reportedAt ?? 0).toBeLessThan(appliedAt ?? 0)
  })
})

describe('sync HTTP protocol version', () => {
  it.each([
    [
      'push',
      pushHandler,
      {
        version: 2,
        messageId: 'message-1',
        deviceId: '11111111-1111-4111-8111-111111111111',
        sentAt: Date.now(),
        kind: 'pushBatch' as const,
        pushBatch: { mutations: [] }
      }
    ],
    [
      'pull',
      pullHandler,
      {
        version: 2,
        messageId: 'message-1',
        deviceId: '11111111-1111-4111-8111-111111111111',
        sentAt: Date.now(),
        kind: 'pullRequest' as const,
        pullRequest: { since: '0' }
      }
    ],
    [
      'bootstrap',
      bootstrapHandler,
      {
        version: PROTOCOL_VERSION,
        messageId: 'message-1',
        deviceId: '11111111-1111-4111-8111-111111111111',
        sentAt: Date.now(),
        kind: 'hello' as const,
        hello: {
          lastPulledAt: '0',
          pendingOpCount: 0,
          protocolVersion: 2
        }
      }
    ]
  ])('rejects %s with PROTOCOL_MISMATCH', async (_name, handler, body) => {
    assertPlan.mockResolvedValueOnce(undefined)
    const next = vi.fn()

    await handler(
      {
        auth: { userId: 'user-1' },
        body,
        get: vi.fn()
      } as never,
      {} as never,
      next
    )

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PROTOCOL_MISMATCH' })
    )
    expect(applyPushBatch).not.toHaveBeenCalled()
    expect(pullChanges).not.toHaveBeenCalled()
    expect(bootstrap).not.toHaveBeenCalled()
  })
})

describe('sync HTTP request validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const DEVICE_ID = '11111111-1111-4111-8111-111111111111'
  const RECORD_ID = '22222222-2222-4222-8222-222222222222'

  const envelope = {
    version: PROTOCOL_VERSION,
    messageId: 'message-1',
    deviceId: DEVICE_ID,
    sentAt: Date.now()
  }

  const topicMutation = (overrides: Record<string, unknown> = {}) => ({
    opId: '33333333-3333-4333-8333-333333333333',
    deviceId: DEVICE_ID,
    table: 'topics',
    recordId: RECORD_ID,
    operation: 'upsert',
    updatedAt: 1,
    topic: {
      id: RECORD_ID,
      title: 'T',
      pivot: 1,
      weekJson: '[]',
      nextUpdateDate: 1,
      updatedAt: 1
    },
    ...overrides
  })

  const pushBody = (mutations: unknown[]) => ({
    ...envelope,
    kind: 'pushBatch',
    pushBatch: { mutations }
  })
  const pullBody = (since: string, deviceId = DEVICE_ID) => ({
    ...envelope,
    deviceId,
    kind: 'pullRequest',
    pullRequest: { since }
  })

  async function rejectedWith(
    handler: typeof pushHandler,
    body: unknown
  ): Promise<unknown> {
    assertPlan.mockResolvedValueOnce(undefined)
    const next = vi.fn()
    await handler(
      { auth: { userId: 'user-1' }, body, get: vi.fn() } as never,
      {} as never,
      next
    )
    expect(applyPushBatch).not.toHaveBeenCalled()
    expect(pullChanges).not.toHaveBeenCalled()
    expect(bootstrap).not.toHaveBeenCalled()
    return next.mock.calls[0]?.[0]
  }

  it.each([
    ['a non-uuid opId', pushBody([topicMutation({ opId: 'op-1' })])],
    ['a non-uuid recordId', pushBody([topicMutation({ recordId: 'topic-1' })])],
    ['a non-uuid envelope deviceId', pullBody('0', 'device-1')],
    [
      'more mutations than the cap',
      pushBody(
        Array.from({ length: MAX_PUSH_MUTATIONS + 1 }, () => topicMutation())
      )
    ],
    ['an oversized pull cursor', pullBody('9'.repeat(MAX_CURSOR_LENGTH + 1))]
  ])('answers 400 VALIDATION_ERROR for %s', async (_name, body) => {
    const handler = body.kind === 'pushBatch' ? pushHandler : pullHandler
    expect(await rejectedWith(handler, body)).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    })
  })

  it('still reports PROTOCOL_MISMATCH before a bad deviceId', async () => {
    const stale = { ...pullBody('0', 'device-1'), version: 2 }
    expect(await rejectedWith(pullHandler, stale)).toMatchObject({
      code: 'PROTOCOL_MISMATCH'
    })
  })

  it('accepts a push at exactly the mutation cap', async () => {
    assertPlan.mockResolvedValueOnce(undefined)
    reportDevice.mockResolvedValueOnce(undefined)
    applyPushBatch.mockResolvedValueOnce({
      acceptedOpIds: [],
      rejected: [],
      conflicts: []
    })
    const res = { status: vi.fn(), json: vi.fn() }
    res.status.mockReturnValue(res)
    const next = vi.fn()

    await pushHandler(
      {
        auth: { userId: 'user-1' },
        body: pushBody(
          Array.from({ length: MAX_PUSH_MUTATIONS }, () => topicMutation())
        ),
        get: vi.fn()
      } as never,
      res as never,
      next
    )

    expect(next).not.toHaveBeenCalled()
    expect(applyPushBatch).toHaveBeenCalledOnce()
  })
})
