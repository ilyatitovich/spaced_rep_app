import { describe, expect, it, vi } from 'vitest'

const assertPlan = vi.fn()
vi.mock('../../settings/services/plan.service.js', () => ({ assertPlan }))
vi.mock('../../shared/lib/redis.js', () => ({
  enforceRateLimit: vi.fn()
}))

const applyPushBatch = vi.fn()
const pullChanges = vi.fn()
const reportDevice = vi.fn()
vi.mock('../sync.service.js', () => ({
  applyPushBatch,
  bootstrap: vi.fn(),
  finishSyncCycle: vi.fn(),
  listSyncDevices: vi.fn(),
  pullChanges,
  reportDevice,
  revokeSyncDevice: vi.fn()
}))
vi.mock('../ws.handler.js', () => ({
  disconnectSyncDevice: vi.fn()
}))

const { pullHandler, pushHandler } = await import('./sync.handler.js')

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
          version: 1,
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
