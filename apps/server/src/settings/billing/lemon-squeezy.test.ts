import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/config/env.js', () => ({
  env: {
    LEMONSQUEEZY_API_KEY: 'api-key',
    LEMONSQUEEZY_STORE_ID: '42',
    LEMONSQUEEZY_TEST_MODE: true,
    BILLING_RETURN_URL: 'https://app.test/settings/subscription'
  }
}))

const { createLemonCheckout, retrieveLemonSubscription } =
  await import('./lemon-squeezy.js')

describe('Lemon Squeezy client', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a hosted checkout with server-owned identity and redirect', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            type: 'checkouts',
            id: 'checkout-1',
            attributes: {
              url: 'https://checkout.test/1',
              expires_at: '2026-09-17T10:00:00.000Z'
            }
          }
        }),
        { status: 201 }
      )
    )
    vi.stubGlobal('fetch', fetch)

    await createLemonCheckout({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'user@example.com',
      variantId: '101',
      expiresAt: new Date('2026-09-17T10:00:00.000Z')
    })

    const request = JSON.parse(fetch.mock.calls[0][1].body)
    expect(request.data.attributes).toEqual(
      expect.objectContaining({
        product_options: {
          redirect_url: 'https://app.test/settings/subscription'
        },
        checkout_options: { embed: false },
        checkout_data: {
          email: 'user@example.com',
          custom: { user_id: '11111111-1111-4111-8111-111111111111' }
        }
      })
    )
    expect(request.data.relationships.variant.data.id).toBe('101')
  })

  it('reads a fresh customer portal URL from a subscription', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              type: 'subscriptions',
              id: 'sub-1',
              attributes: {
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
                urls: { customer_portal: 'https://portal.test/fresh' }
              }
            }
          })
        )
      )
    )

    const subscription = await retrieveLemonSubscription('sub-1')
    expect(subscription.attributes.urls?.customer_portal).toBe(
      'https://portal.test/fresh'
    )
  })

  it('maps provider network failures to a bounded gateway error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))

    await expect(retrieveLemonSubscription('sub-1')).rejects.toMatchObject({
      statusCode: 502,
      code: 'BILLING_UNAVAILABLE'
    })
  })
})
