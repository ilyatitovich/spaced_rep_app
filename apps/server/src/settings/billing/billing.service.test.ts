import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    LEMONSQUEEZY_API_KEY: 'api-key',
    LEMONSQUEEZY_WEBHOOK_SECRET: 'webhook-secret',
    LEMONSQUEEZY_STORE_ID: '42',
    LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID: '100',
    LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID: '101',
    LEMONSQUEEZY_TEST_MODE: true,
    BILLING_RETURN_URL: 'https://app.test/settings/subscription'
  }
}))

const prisma = {
  user: { findUnique: vi.fn() },
  subscription: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn()
  },
  billingEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  billingCheckoutIntent: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn()
}

vi.mock('../../shared/lib/prisma.js', () => ({ prisma }))

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
vi.mock('../../shared/lib/logger.js', () => ({ logger }))

vi.mock('../../shared/lib/redis.js', () => ({
  enforceRateLimit: vi.fn()
}))

vi.mock('../services/ensure.service.js', () => ({
  ensureUserSettings: vi.fn()
}))

const lemon = {
  createLemonCheckout: vi.fn(),
  retrieveLemonSubscription: vi.fn(),
  cancelLemonSubscription: vi.fn()
}
vi.mock('./lemon-squeezy.js', () => lemon)

const { env } = await import('../../shared/config/env.js')
const {
  createCheckout,
  getPortalUrl,
  processLemonWebhook,
  reconcileStaleSubscriptions,
  reconcileSubscription,
  verifyLemonSignature
} = await import('./billing.service.js')

function subscriptionAttributes(overrides: Record<string, unknown> = {}) {
  return {
    store_id: 42,
    customer_id: 7,
    variant_id: 101,
    status: 'active',
    cancelled: false,
    trial_ends_at: null,
    renews_at: '2027-01-01T00:00:00.000Z',
    ends_at: null,
    created_at: '2026-09-17T08:00:00.000Z',
    updated_at: '2026-09-17T08:01:00.000Z',
    test_mode: true,
    ...overrides
  }
}

function signedWebhook(attributes = subscriptionAttributes()) {
  return signedPayload({
    meta: {
      event_name: 'subscription_created',
      custom_data: { user_id: '11111111-1111-4111-8111-111111111111' }
    },
    data: { type: 'subscriptions', id: 'sub-new', attributes }
  })
}

function signedPayload(payload: unknown) {
  const body = Buffer.from(JSON.stringify(payload))
  const signature = createHmac('sha256', 'webhook-secret')
    .update(body)
    .digest('hex')
  return { body, signature }
}

describe('billing service', () => {
  beforeEach(() => {
    env.NODE_ENV = 'test'
    env.LEMONSQUEEZY_API_KEY = 'api-key'
    vi.clearAllMocks()
    lemon.createLemonCheckout.mockReset()
    lemon.retrieveLemonSubscription.mockReset()
    lemon.cancelLemonSubscription.mockReset()
    prisma.$transaction.mockImplementation(async callback => callback(prisma))
    prisma.billingEvent.findUnique.mockResolvedValue(null)
    prisma.billingEvent.create.mockResolvedValue({})
    prisma.billingEvent.update.mockResolvedValue({})
    prisma.user.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'user@example.com'
    })
  })

  it('rejects malformed or unequal-length webhook signatures safely', () => {
    expect(verifyLemonSignature(Buffer.from('{}'), 'abc')).toBe(false)
    expect(verifyLemonSignature(Buffer.from('{}'), 'z'.repeat(64))).toBe(false)
  })

  it('rejects malformed webhook JSON after signature verification', async () => {
    const body = Buffer.from('{')
    const signature = createHmac('sha256', 'webhook-secret')
      .update(body)
      .digest('hex')

    await expect(processLemonWebhook(body, signature)).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    })
  })

  it('reuses an unexpired checkout intent', async () => {
    prisma.billingCheckoutIntent.findFirst.mockResolvedValue({
      checkoutUrl: 'https://checkout.test/existing'
    })

    await expect(
      createCheckout('11111111-1111-4111-8111-111111111111', 'year')
    ).resolves.toEqual({ url: 'https://checkout.test/existing' })
    expect(lemon.createLemonCheckout).not.toHaveBeenCalled()
  })

  it('grants Pro locally when Lemon is not configured', async () => {
    env.LEMONSQUEEZY_API_KEY = ''
    prisma.subscription.update.mockResolvedValue({})

    await expect(
      createCheckout('11111111-1111-4111-8111-111111111111', 'year')
    ).resolves.toEqual({ url: 'https://app.test/settings/subscription' })
    expect(lemon.createLemonCheckout).not.toHaveBeenCalled()
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { userId: '11111111-1111-4111-8111-111111111111' },
      data: expect.objectContaining({
        plan: 'PRO',
        status: 'ACTIVE',
        provider: 'NONE'
      })
    })

  })

  it('creates checkout server-side with authenticated identity', async () => {
    prisma.billingCheckoutIntent.findFirst.mockResolvedValue(null)
    lemon.createLemonCheckout.mockResolvedValue({
      id: 'checkout-1',
      attributes: { url: 'https://checkout.test/new' }
    })

    await expect(
      createCheckout('11111111-1111-4111-8111-111111111111', 'year')
    ).resolves.toEqual({ url: 'https://checkout.test/new' })
    expect(lemon.createLemonCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        variantId: '101'
      })
    )
  })

  it('fetches a fresh portal URL instead of storing it', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      provider: 'LEMON_SQUEEZY',
      providerSubscriptionId: 'sub-1'
    })
    lemon.retrieveLemonSubscription.mockResolvedValue({
      id: 'sub-1',
      attributes: {
        urls: { customer_portal: 'https://portal.test/fresh' }
      }
    })

    await expect(getPortalUrl('user-1')).resolves.toEqual({
      url: 'https://portal.test/fresh'
    })
    expect(lemon.retrieveLemonSubscription).toHaveBeenCalledWith('sub-1')
  })

  it('applies a valid webhook once with LWW provider time', async () => {
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      provider: 'NONE',
      providerSubscriptionId: null,
      providerUpdatedAt: null,
      status: 'ACTIVE',
      endsAt: null
    })
    const request = signedWebhook()

    await processLemonWebhook(request.body, request.signature)
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plan: 'PRO',
          providerSubscriptionId: 'sub-new',
          providerUpdatedAt: new Date('2026-09-17T08:01:00.000Z')
        })
      })
    )

    prisma.billingEvent.findUnique.mockResolvedValue({
      processedAt: new Date()
    })
    await processLemonWebhook(request.body, request.signature)
    expect(prisma.subscription.update).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['store', { store_id: 99 }],
    ['mode', { test_mode: false }]
  ])('rejects a webhook with a mismatched %s', async (_name, overrides) => {
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      provider: 'NONE',
      providerSubscriptionId: null,
      providerUpdatedAt: null,
      status: 'ACTIVE',
      endsAt: null
    })
    const request = signedWebhook(subscriptionAttributes(overrides))

    await expect(
      processLemonWebhook(request.body, request.signature)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(prisma.subscription.update).not.toHaveBeenCalled()
  })

  it('ignores unknown users and variants without granting access', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null)
    const unknownUser = signedWebhook()

    await processLemonWebhook(unknownUser.body, unknownUser.signature)
    expect(prisma.subscription.update).not.toHaveBeenCalled()

    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(async callback => callback(prisma))
    prisma.billingEvent.findUnique.mockResolvedValue(null)
    prisma.billingEvent.create.mockResolvedValue({})
    prisma.billingEvent.update.mockResolvedValue({})
    prisma.user.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111'
    })
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      provider: 'NONE',
      providerSubscriptionId: null,
      providerUpdatedAt: null,
      status: 'ACTIVE',
      endsAt: null
    })
    const unknownVariant = signedWebhook(
      subscriptionAttributes({ variant_id: 999 })
    )

    await processLemonWebhook(unknownVariant.body, unknownVariant.signature)
    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('retrieves subscription state after a refund event', async () => {
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      provider: 'LEMON_SQUEEZY',
      providerSubscriptionId: 'sub-1',
      providerUpdatedAt: null,
      status: 'ACTIVE',
      endsAt: null
    })
    lemon.retrieveLemonSubscription.mockResolvedValue({
      id: 'sub-1',
      attributes: subscriptionAttributes({ status: 'expired' })
    })
    const request = signedPayload({
      meta: {
        event_name: 'subscription_payment_refunded',
        custom_data: { user_id: '11111111-1111-4111-8111-111111111111' }
      },
      data: {
        type: 'subscription-invoices',
        id: 'invoice-1',
        attributes: { subscription_id: 'sub-1' }
      }
    })

    await processLemonWebhook(request.body, request.signature)

    expect(lemon.retrieveLemonSubscription).toHaveBeenCalledWith('sub-1')
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EXPIRED' })
      })
    )
  })

  it('ignores an out-of-order webhook without delaying reconciliation', async () => {
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      provider: 'LEMON_SQUEEZY',
      providerSubscriptionId: 'sub-new',
      providerUpdatedAt: new Date('2026-09-17T08:02:00.000Z'),
      status: 'ACTIVE',
      endsAt: null
    })
    const request = signedWebhook(subscriptionAttributes({ status: 'expired' }))

    await processLemonWebhook(request.body, request.signature)

    expect(prisma.subscription.update).not.toHaveBeenCalled()
  })

  it('reconciles a subscription from the provider', async () => {
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      provider: 'LEMON_SQUEEZY',
      providerSubscriptionId: 'sub-1',
      providerUpdatedAt: new Date('2026-09-16T08:00:00.000Z'),
      status: 'ACTIVE',
      endsAt: null
    })
    lemon.retrieveLemonSubscription.mockResolvedValue({
      id: 'sub-1',
      attributes: subscriptionAttributes({
        status: 'unpaid',
        updated_at: '2026-09-17T09:00:00.000Z'
      })
    })

    await reconcileSubscription('11111111-1111-4111-8111-111111111111', 'sub-1')

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'UNPAID',
          providerUpdatedAt: new Date('2026-09-17T09:00:00.000Z'),
          lastVerifiedAt: expect.any(Date)
        })
      })
    )
  })

  it('records verification when reconciliation finds no provider change', async () => {
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      provider: 'LEMON_SQUEEZY',
      providerSubscriptionId: 'sub-1',
      providerUpdatedAt: new Date('2026-09-17T08:01:00.000Z'),
      status: 'ACTIVE',
      endsAt: null
    })
    lemon.retrieveLemonSubscription.mockResolvedValue({
      id: 'sub-1',
      attributes: subscriptionAttributes()
    })

    await reconcileSubscription('11111111-1111-4111-8111-111111111111', 'sub-1')

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { userId: '11111111-1111-4111-8111-111111111111' },
      data: { lastVerifiedAt: expect.any(Date) }
    })
  })

  it('reconciles all stale Lemon subscriptions without aborting the batch', async () => {
    const now = new Date('2026-09-17T12:00:00.000Z')
    prisma.subscription.findMany.mockResolvedValue([
      { userId: 'user-1', providerSubscriptionId: 'sub-1' },
      { userId: 'user-2', providerSubscriptionId: 'sub-2' }
    ])
    lemon.retrieveLemonSubscription
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce({
        id: 'sub-2',
        attributes: subscriptionAttributes()
      })
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      provider: 'LEMON_SQUEEZY',
      providerSubscriptionId: 'sub-2',
      providerUpdatedAt: null,
      status: 'ACTIVE',
      endsAt: null
    })

    await reconcileStaleSubscriptions(now)

    expect(prisma.subscription.findMany).toHaveBeenCalledWith({
      where: {
        provider: 'LEMON_SQUEEZY',
        providerSubscriptionId: { not: null },
        status: { not: 'EXPIRED' },
        OR: [
          { lastVerifiedAt: null },
          {
            lastVerifiedAt: {
              lte: new Date('2026-09-16T12:00:00.000Z')
            }
          }
        ]
      },
      select: { userId: true, providerSubscriptionId: true }
    })
    expect(lemon.retrieveLemonSubscription).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      'Billing reconciliation failed'
    )
  })

  it('cancels the newer duplicate and raises a manual-refund alert', async () => {
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      provider: 'LEMON_SQUEEZY',
      providerSubscriptionId: 'sub-existing',
      providerUpdatedAt: new Date('2026-09-17T08:00:00.000Z'),
      status: 'ACTIVE',
      endsAt: null
    })
    lemon.retrieveLemonSubscription.mockResolvedValue({
      id: 'sub-existing',
      attributes: subscriptionAttributes({
        created_at: '2026-09-16T08:00:00.000Z'
      })
    })
    const request = signedWebhook()

    await processLemonWebhook(request.body, request.signature)

    expect(lemon.cancelLemonSubscription).toHaveBeenCalledWith('sub-new')
    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        duplicateSubscriptionId: 'sub-new',
        requiresManualRefund: true
      }),
      expect.stringContaining('manual remediation')
    )
  })
})
