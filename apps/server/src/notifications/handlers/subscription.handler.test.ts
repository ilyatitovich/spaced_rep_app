import { describe, expect, it, vi } from 'vitest'

const assertPlan = vi.fn()
vi.mock('../../settings/services/plan.service.js', () => ({ assertPlan }))

const upsertPushSubscription = vi.fn()
vi.mock('../services/push.service.js', () => ({
  deletePushSubscription: vi.fn(),
  getVapidPublicKey: vi.fn(),
  upsertPushSubscription
}))

const { upsertSubscriptionHandler } = await import('./subscription.handler.js')

describe('upsertSubscriptionHandler', () => {
  it('blocks registration after entitlement loss', async () => {
    const error = Object.assign(new Error('Pro required'), {
      code: 'PLAN_REQUIRED'
    })
    assertPlan.mockRejectedValue(error)
    const next = vi.fn()

    await upsertSubscriptionHandler(
      {
        auth: { userId: 'user-1' },
        body: {},
        get: vi.fn()
      } as never,
      {} as never,
      next
    )

    expect(next).toHaveBeenCalledWith(error)
    expect(upsertPushSubscription).not.toHaveBeenCalled()
  })
})
