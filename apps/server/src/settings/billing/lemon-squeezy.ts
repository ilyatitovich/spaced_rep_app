import { z } from 'zod'
import { env } from '../../shared/config/env.js'
import { BadGatewayError } from '../../shared/lib/errors.js'

const API_URL = 'https://api.lemonsqueezy.com/v1'
const REQUEST_TIMEOUT_MS = 8_000

const subscriptionAttributesSchema = z.object({
  store_id: z.number(),
  customer_id: z.number(),
  variant_id: z.number(),
  status: z.string(),
  cancelled: z.boolean(),
  trial_ends_at: z.string().nullable(),
  renews_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  test_mode: z.boolean(),
  urls: z
    .object({
      customer_portal: z.string().url()
    })
    .optional()
})

const subscriptionSchema = z.object({
  data: z.object({
    type: z.literal('subscriptions'),
    id: z.string(),
    attributes: subscriptionAttributesSchema
  })
})

const checkoutSchema = z.object({
  data: z.object({
    type: z.literal('checkouts'),
    id: z.string(),
    attributes: z.object({
      url: z.string().url(),
      expires_at: z.string().nullable()
    })
  })
})

export type LemonSubscriptionAttributes = z.infer<
  typeof subscriptionAttributesSchema
>

function requireBillingConfig() {
  const values = {
    apiKey: env.LEMONSQUEEZY_API_KEY,
    storeId: env.LEMONSQUEEZY_STORE_ID,
    returnUrl: env.BILLING_RETURN_URL
  }
  if (Object.values(values).some(value => !value)) {
    throw new Error('Lemon Squeezy billing is not configured')
  }
  return values
}

async function lemonRequest(
  path: string,
  init?: RequestInit
): Promise<unknown> {
  const { apiKey } = requireBillingConfig()
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`,
        ...init?.headers
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch {
    throw new BadGatewayError(
      'Billing provider unavailable',
      'BILLING_UNAVAILABLE'
    )
  }

  if (!response.ok) {
    throw new BadGatewayError(
      `Billing provider returned ${response.status}`,
      'BILLING_PROVIDER_ERROR'
    )
  }

  if (response.status === 204) return null
  try {
    return await response.json()
  } catch {
    throw new BadGatewayError(
      'Billing provider returned an invalid response',
      'BILLING_PROVIDER_ERROR'
    )
  }
}

function parseProviderResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new BadGatewayError(
      'Billing provider returned an invalid response',
      'BILLING_PROVIDER_ERROR'
    )
  }
  return parsed.data
}

export async function createLemonCheckout(input: {
  userId: string
  email: string
  variantId: string
  expiresAt: Date
}) {
  const { storeId, returnUrl } = requireBillingConfig()
  const response = await lemonRequest('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          product_options: { redirect_url: returnUrl },
          checkout_options: { embed: false },
          checkout_data: {
            email: input.email,
            custom: { user_id: input.userId }
          },
          expires_at: input.expiresAt.toISOString(),
          test_mode: env.LEMONSQUEEZY_TEST_MODE
        },
        relationships: {
          store: { data: { type: 'stores', id: storeId } },
          variant: { data: { type: 'variants', id: input.variantId } }
        }
      }
    })
  })
  return parseProviderResponse(checkoutSchema, response).data
}

export async function retrieveLemonSubscription(subscriptionId: string) {
  const response = await lemonRequest(`/subscriptions/${subscriptionId}`)
  return parseProviderResponse(subscriptionSchema, response).data
}

export async function cancelLemonSubscription(subscriptionId: string) {
  await lemonRequest(`/subscriptions/${subscriptionId}`, { method: 'DELETE' })
}
