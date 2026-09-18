import { describe, expect, it, vi } from 'vitest'
import { PROTOCOL_VERSION } from '@spaced-rep/sync-protocol'

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

const { bootstrapHandler, pullHandler, pushHandler } = await import(
  './sync.handler.js'
)

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
    expect(reportDevice.mock.invocationCallOrder[0]).toBeLessThan(
      applyPushBatch.mock.invocationCallOrder[0]
    )
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
        pullRequest: { since: new Date(0).toISOString() }
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
          lastPulledAt: new Date(0).toISOString(),
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
