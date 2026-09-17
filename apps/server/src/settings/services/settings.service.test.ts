import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  subscription: {
    findUniqueOrThrow: vi.fn()
  }
}

vi.mock('../../shared/lib/prisma.js', () => ({ prisma }))
vi.mock('../../shared/lib/logger.js', () => ({
  logger: { error: vi.fn() }
}))
vi.mock('./ensure.service.js', () => ({
  ensureUserSettings: vi.fn()
}))
vi.mock('./plan.service.js', () => ({
  assertPlan: vi.fn()
}))

const billing = {
  isSubscriptionVerificationStale: vi.fn(),
  reconcileSubscription: vi.fn()
}
vi.mock('../billing/billing.service.js', () => billing)

const { getSubscriptionDto } = await import('./settings.service.js')

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    plan: 'PRO',
    status: 'ACTIVE',
    provider: 'LEMON_SQUEEZY',
    providerSubscriptionId: 'sub-1',
    currentPeriodEnd: null,
    endsAt: null,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    serverUpdatedAt: new Date(),
    lastVerifiedAt: new Date(),
    ...overrides
  }
}

describe('getSubscriptionDto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reconciles a stale Lemon subscription before returning it', async () => {
    const stale = subscription()
    const refreshed = subscription({ status: 'UNPAID' })
    prisma.subscription.findUniqueOrThrow
      .mockResolvedValueOnce(stale)
      .mockResolvedValueOnce(refreshed)
    billing.isSubscriptionVerificationStale.mockReturnValue(true)

    const result = await getSubscriptionDto('user-1')

    expect(billing.reconcileSubscription).toHaveBeenCalledWith(
      'user-1',
      'sub-1'
    )
    expect(prisma.subscription.findUniqueOrThrow).toHaveBeenCalledTimes(2)
    expect(result.status).toBe('unpaid')
  })

  it('returns cached state when provider verification is fresh', async () => {
    prisma.subscription.findUniqueOrThrow.mockResolvedValue(subscription())
    billing.isSubscriptionVerificationStale.mockReturnValue(false)

    await getSubscriptionDto('user-1')

    expect(billing.reconcileSubscription).not.toHaveBeenCalled()
    expect(prisma.subscription.findUniqueOrThrow).toHaveBeenCalledOnce()
  })
})
