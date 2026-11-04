import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getTestPrisma } from '../../../../../testing/db/prisma.js'
import { userFactory } from '../../../../../testing/factories/user.factory.js'
import { createTestAgent } from '../../../../../testing/helpers/http/supertest-app.js'
import { env } from '../../shared/config/env.js'
import { ensureUserSettings } from '../services/ensure.service.js'

const SECRET = 'integration-webhook-secret'
const STORE_ID = '42'
const VARIANT_ID = '101'

function subscriptionPayload(userId: string) {
  return {
    meta: {
      event_name: 'subscription_created',
      custom_data: { user_id: userId }
    },
    data: {
      type: 'subscriptions',
      id: 'sub-http-1',
      attributes: {
        store_id: Number(STORE_ID),
        customer_id: 7,
        variant_id: Number(VARIANT_ID),
        status: 'active',
        cancelled: false,
        trial_ends_at: null,
        renews_at: '2027-01-01T00:00:00.000Z',
        ends_at: null,
        created_at: '2026-09-17T08:00:00.000Z',
        updated_at: '2026-09-17T08:01:00.000Z',
        test_mode: true
      }
    }
  }
}

function signedBody(payload: unknown) {
  const body = Buffer.from(JSON.stringify(payload))
  const signature = createHmac('sha256', SECRET).update(body).digest('hex')
  return { body, signature }
}

describe('POST /settings/billing/webhook', () => {
  const previous = {
    secret: '',
    storeId: '',
    monthly: '',
    yearly: '',
    testMode: false
  }

  beforeEach(() => {
    previous.secret = env.LEMONSQUEEZY_WEBHOOK_SECRET
    previous.storeId = env.LEMONSQUEEZY_STORE_ID
    previous.monthly = env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID
    previous.yearly = env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID
    previous.testMode = env.LEMONSQUEEZY_TEST_MODE
    env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET
    env.LEMONSQUEEZY_STORE_ID = STORE_ID
    env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID = '100'
    env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID = VARIANT_ID
    env.LEMONSQUEEZY_TEST_MODE = true
  })

  afterEach(() => {
    env.LEMONSQUEEZY_WEBHOOK_SECRET = previous.secret
    env.LEMONSQUEEZY_STORE_ID = previous.storeId
    env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID = previous.monthly
    env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID = previous.yearly
    env.LEMONSQUEEZY_TEST_MODE = previous.testMode
  })

  it('applies a signed subscription_created payload over the raw body path', async () => {
    const user = await userFactory.create()
    await ensureUserSettings(user.id)
    const { body, signature } = signedBody(subscriptionPayload(user.id))
    const agent = await createTestAgent()

    const res = await agent
      .post('/settings/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Signature', signature)
      // String keeps the exact signed bytes; a Buffer is re-encoded by SuperAgent.
      .send(body.toString('utf8'))

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { received: true } })
    expect(
      await getTestPrisma().subscription.findUnique({
        where: { userId: user.id }
      })
    ).toMatchObject({
      plan: 'PRO',
      status: 'ACTIVE',
      provider: 'LEMON_SQUEEZY',
      providerSubscriptionId: 'sub-http-1'
    })
  })

  it('rejects a bad signature with 401 without touching the subscription', async () => {
    const user = await userFactory.create()
    await ensureUserSettings(user.id)
    const { body } = signedBody(subscriptionPayload(user.id))
    const agent = await createTestAgent()

    const res = await agent
      .post('/settings/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Signature', 'ab'.repeat(32))
      .send(body.toString('utf8'))

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
    expect(
      await getTestPrisma().subscription.findUnique({
        where: { userId: user.id }
      })
    ).toMatchObject({
      plan: 'FREE',
      provider: 'NONE',
      providerSubscriptionId: null
    })
  })
})
