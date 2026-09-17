import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type {
  PlanTier,
  SubscriptionStatus
} from '../../generated/prisma/client.js'
import { env } from '../../shared/config/env.js'
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} from '../../shared/lib/errors.js'
import { logger } from '../../shared/lib/logger.js'
import { prisma } from '../../shared/lib/prisma.js'
import { enforceRateLimit } from '../../shared/lib/redis.js'
import { ensureUserSettings } from '../services/ensure.service.js'
import { isSubscriptionEntitled } from '../services/plan-entitlement.js'
import type { BillingInterval } from './product.js'
import {
  cancelLemonSubscription,
  createLemonCheckout,
  type LemonSubscriptionAttributes,
  retrieveLemonSubscription
} from './lemon-squeezy.js'

const CHECKOUT_TTL_MS = 60 * 60 * 1_000
export const SUBSCRIPTION_STALE_MS = 24 * 60 * 60 * 1_000
const RECONCILIATION_INTERVAL_MS = SUBSCRIPTION_STALE_MS

let reconciliationTimer: ReturnType<typeof setInterval> | null = null
let reconciliationRunning = false

const webhookSchema = z.object({
  meta: z.object({
    event_name: z.string(),
    custom_data: z
      .object({ user_id: z.union([z.string(), z.number()]) })
      .optional()
  }),
  data: z.object({
    type: z.string(),
    id: z.string(),
    attributes: z.record(z.string(), z.unknown())
  })
})

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
  test_mode: z.boolean()
})

const PAYMENT_EVENTS = new Set([
  'subscription_payment_failed',
  'subscription_payment_success',
  'subscription_payment_recovered',
  'subscription_payment_refunded'
])

const SUBSCRIPTION_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused'
])

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: 'ACTIVE',
  on_trial: 'TRIALING',
  past_due: 'PAST_DUE',
  cancelled: 'CANCELED',
  expired: 'EXPIRED',
  paused: 'PAUSED',
  unpaid: 'UNPAID'
}

function billingVariant(interval: BillingInterval): string {
  const variant =
    interval === 'month'
      ? env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID
      : env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID
  if (!variant)
    throw new Error(`Lemon Squeezy ${interval} variant is not configured`)
  return variant
}

function variantPlan(variantId: number): PlanTier | null {
  const id = String(variantId)
  return id === env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID ||
    id === env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID
    ? 'PRO'
    : null
}

export function verifyLemonSignature(body: Buffer, signature: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature) || !env.LEMONSQUEEZY_WEBHOOK_SECRET) {
    return false
  }
  const expected = createHmac('sha256', env.LEMONSQUEEZY_WEBHOOK_SECRET)
    .update(body)
    .digest()
  const supplied = Buffer.from(signature, 'hex')
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  )
}

export async function createCheckout(
  userId: string,
  interval: BillingInterval
) {
  await enforceRateLimit({
    key: `billing:checkout:${userId}`,
    limit: 5,
    windowSeconds: 60
  })
  const variantId = billingVariant(interval)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  })
  if (!user) throw new NotFoundError('User not found')

  return prisma.$transaction(
    async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`
      const now = new Date()
      const existing = await tx.billingCheckoutIntent.findFirst({
        where: {
          userId,
          plan: 'PRO',
          provider: 'LEMON_SQUEEZY',
          expiresAt: { gt: now }
        },
        orderBy: { createdAt: 'desc' }
      })
      if (existing) return { url: existing.checkoutUrl }

      const expiresAt = new Date(now.getTime() + CHECKOUT_TTL_MS)
      const checkout = await createLemonCheckout({
        userId,
        email: user.email,
        variantId,
        expiresAt
      })
      await tx.billingCheckoutIntent.create({
        data: {
          userId,
          plan: 'PRO',
          provider: 'LEMON_SQUEEZY',
          providerCheckoutId: checkout.id,
          checkoutUrl: checkout.attributes.url,
          expiresAt
        }
      })
      return { url: checkout.attributes.url }
    },
    { timeout: 12_000 }
  )
}

export async function getPortalUrl(userId: string) {
  await enforceRateLimit({
    key: `billing:portal:${userId}`,
    limit: 10,
    windowSeconds: 60
  })
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  })
  if (
    !subscription?.providerSubscriptionId ||
    subscription.provider !== 'LEMON_SQUEEZY'
  ) {
    throw new BadRequestError(
      'No Lemon Squeezy subscription',
      'NO_SUBSCRIPTION'
    )
  }
  const remote = await retrieveLemonSubscription(
    subscription.providerSubscriptionId
  )
  const url = remote.attributes.urls?.customer_portal
  if (!url) throw new BadRequestError('Customer portal unavailable')
  return { url }
}

function date(value: string | null): Date | null {
  return value ? new Date(value) : null
}

function isOlderSubscription(
  left: { id: string; createdAt: string },
  right: { id: string; createdAt: string }
): boolean {
  const byDate =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  return byDate < 0 || (byDate === 0 && left.id.localeCompare(right.id) < 0)
}

async function resolveDuplicate(
  existingId: string,
  incomingId: string,
  incoming: LemonSubscriptionAttributes
): Promise<'existing' | 'incoming'> {
  const existing = await retrieveLemonSubscription(existingId)
  const keepIncoming = isOlderSubscription(
    { id: incomingId, createdAt: incoming.created_at },
    { id: existing.id, createdAt: existing.attributes.created_at }
  )
  const duplicateId = keepIncoming ? existingId : incomingId
  await cancelLemonSubscription(duplicateId)
  logger.error(
    {
      authoritativeSubscriptionId: keepIncoming ? incomingId : existingId,
      duplicateSubscriptionId: duplicateId,
      requiresManualRefund: true
    },
    'Duplicate Lemon Squeezy subscription canceled; refund requires manual remediation'
  )
  return keepIncoming ? 'incoming' : 'existing'
}

async function applySubscription(
  userId: string,
  subscriptionId: string,
  attributes: LemonSubscriptionAttributes,
  touchVerification = false
) {
  if (String(attributes.store_id) !== env.LEMONSQUEEZY_STORE_ID) {
    throw new ForbiddenError('Webhook store mismatch')
  }
  if (attributes.test_mode !== env.LEMONSQUEEZY_TEST_MODE) {
    throw new ForbiddenError('Webhook mode mismatch')
  }

  const plan = variantPlan(attributes.variant_id)
  if (!plan) {
    logger.warn(
      { variantId: attributes.variant_id },
      'Ignoring unknown billing variant'
    )
    return
  }
  const status = STATUS_MAP[attributes.status]
  if (!status) {
    logger.warn(
      { status: attributes.status },
      'Ignoring unknown subscription status'
    )
    return
  }

  await ensureUserSettings(userId)
  const current = await prisma.subscription.findUniqueOrThrow({
    where: { userId }
  })
  const incomingUpdatedAt = new Date(attributes.updated_at)

  if (
    current.provider === 'LEMON_SQUEEZY' &&
    current.providerSubscriptionId &&
    current.providerSubscriptionId !== subscriptionId &&
    isSubscriptionEntitled(current.status, current.endsAt)
  ) {
    if (!isSubscriptionEntitled(status, date(attributes.ends_at))) return
    const winner = await resolveDuplicate(
      current.providerSubscriptionId,
      subscriptionId,
      attributes
    )
    if (winner === 'existing') return
  } else if (
    current.providerSubscriptionId === subscriptionId &&
    current.providerUpdatedAt &&
    incomingUpdatedAt <= current.providerUpdatedAt
  ) {
    if (touchVerification) {
      await prisma.subscription.update({
        where: { userId },
        data: { lastVerifiedAt: new Date() }
      })
    }
    return
  }

  await prisma.subscription.update({
    where: { userId },
    data: {
      plan,
      status,
      provider: 'LEMON_SQUEEZY',
      providerCustomerId: String(attributes.customer_id),
      providerSubscriptionId: subscriptionId,
      providerVariantId: String(attributes.variant_id),
      providerUpdatedAt: incomingUpdatedAt,
      lastVerifiedAt: new Date(),
      currentPeriodEnd: date(attributes.renews_at),
      endsAt: date(attributes.ends_at),
      trialEndsAt: date(attributes.trial_ends_at),
      cancelAtPeriodEnd: attributes.cancelled,
      canceledAt: status === 'CANCELED' ? new Date() : null
    }
  })
}

export function isSubscriptionVerificationStale(
  lastVerifiedAt: Date | null,
  now = new Date()
): boolean {
  return (
    !lastVerifiedAt ||
    lastVerifiedAt.getTime() <= now.getTime() - SUBSCRIPTION_STALE_MS
  )
}

export async function reconcileSubscription(
  userId: string,
  subscriptionId: string
): Promise<void> {
  const remote = await retrieveLemonSubscription(subscriptionId)
  await applySubscription(userId, remote.id, remote.attributes, true)
}

export async function reconcileStaleSubscriptions(
  now = new Date()
): Promise<void> {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      provider: 'LEMON_SQUEEZY',
      providerSubscriptionId: { not: null },
      status: { not: 'EXPIRED' },
      OR: [
        { lastVerifiedAt: null },
        {
          lastVerifiedAt: {
            lte: new Date(now.getTime() - SUBSCRIPTION_STALE_MS)
          }
        }
      ]
    },
    select: { userId: true, providerSubscriptionId: true }
  })

  for (const subscription of subscriptions) {
    if (!subscription.providerSubscriptionId) continue
    try {
      await reconcileSubscription(
        subscription.userId,
        subscription.providerSubscriptionId
      )
    } catch (err) {
      logger.error(
        {
          err,
          userId: subscription.userId,
          subscriptionId: subscription.providerSubscriptionId
        },
        'Billing reconciliation failed'
      )
    }
  }
}

async function runBillingReconciliation(): Promise<void> {
  if (reconciliationRunning) return
  reconciliationRunning = true
  try {
    await reconcileStaleSubscriptions()
  } catch (err) {
    logger.error({ err }, 'Billing reconciliation scan failed')
  } finally {
    reconciliationRunning = false
  }
}

export function startBillingReconciler(): void {
  if (reconciliationTimer) return
  void runBillingReconciliation()
  reconciliationTimer = setInterval(() => {
    void runBillingReconciliation()
  }, RECONCILIATION_INTERVAL_MS)
  reconciliationTimer.unref()
  logger.info('Billing reconciler started')
}

export function stopBillingReconciler(): void {
  if (!reconciliationTimer) return
  clearInterval(reconciliationTimer)
  reconciliationTimer = null
}

export async function processLemonWebhook(body: Buffer, signature: string) {
  if (!verifyLemonSignature(body, signature)) {
    throw new UnauthorizedError('Invalid webhook signature')
  }

  let json: unknown
  try {
    json = JSON.parse(body.toString('utf8'))
  } catch {
    throw new BadRequestError('Malformed webhook JSON')
  }
  const parsedPayload = webhookSchema.safeParse(json)
  if (!parsedPayload.success) {
    throw new BadRequestError('Invalid webhook payload')
  }
  const payload = parsedPayload.data
  const idempotencyKey = createHash('sha256').update(body).digest('hex')
  const existingEvent = await prisma.billingEvent.findUnique({
    where: { idempotencyKey }
  })
  if (existingEvent?.processedAt) return
  if (!existingEvent) {
    try {
      await prisma.billingEvent.create({
        data: {
          provider: 'LEMON_SQUEEZY',
          eventType: payload.meta.event_name,
          idempotencyKey,
          payload: JSON.parse(body.toString('utf8'))
        }
      })
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'P2002'
      )) {
        throw error
      }
    }
  }

  const rawUserId = payload.meta.custom_data?.user_id
  const userId = rawUserId == null ? null : String(rawUserId)
  if (!userId || !z.string().uuid().safeParse(userId).success) {
    logger.warn(
      { event: payload.meta.event_name },
      'Ignoring billing event without valid user_id'
    )
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })
    if (!user) {
      logger.warn({ userId }, 'Ignoring billing event for unknown user')
    } else {
      await prisma.$transaction(
        async tx => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`
          if (
            payload.data.type === 'subscriptions' &&
            SUBSCRIPTION_EVENTS.has(payload.meta.event_name)
          ) {
            const parsedAttributes = subscriptionAttributesSchema.safeParse(
              payload.data.attributes
            )
            if (!parsedAttributes.success) {
              throw new BadRequestError('Invalid subscription webhook payload')
            }
            await applySubscription(
              userId,
              payload.data.id,
              parsedAttributes.data
            )
          } else if (PAYMENT_EVENTS.has(payload.meta.event_name)) {
            const parsedSubscriptionId = z
              .union([z.string().min(1), z.number()])
              .safeParse(payload.data.attributes.subscription_id)
            if (!parsedSubscriptionId.success) {
              throw new BadRequestError('Missing payment subscription_id')
            }
            const remote = await retrieveLemonSubscription(
              String(parsedSubscriptionId.data)
            )
            await applySubscription(userId, remote.id, remote.attributes)
          }
        },
        { timeout: 25_000 }
      )
    }
  }

  await prisma.billingEvent.update({
    where: { idempotencyKey },
    data: { processedAt: new Date() }
  })
}
