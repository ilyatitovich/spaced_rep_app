import type { PlanTier, SubscriptionStatus } from '../../generated/prisma/client.js'
import { ForbiddenError } from '../../shared/lib/errors.js'
import { prisma } from '../../shared/lib/prisma.js'
import { ensureUserSettings } from './ensure.service.js'

const ENTITLED: SubscriptionStatus[] = ['ACTIVE', 'TRIALING']

const PLAN_RANK: Record<PlanTier, number> = {
  FREE: 0,
  PRO: 1,
  PRO_PLUS: 2
}

export async function getSubscription(userId: string) {
  await ensureUserSettings(userId)
  return prisma.subscription.findUniqueOrThrow({ where: { userId } })
}

/** True when plan meets minimum tier and status is active/trialing. */
export function isPlanEntitled(
  plan: PlanTier,
  status: SubscriptionStatus,
  minimum: PlanTier
): boolean {
  return ENTITLED.includes(status) && PLAN_RANK[plan] >= PLAN_RANK[minimum]
}

export async function assertPlan(
  userId: string,
  minimum: PlanTier
): Promise<void> {
  const sub = await getSubscription(userId)
  if (!isPlanEntitled(sub.plan, sub.status, minimum)) {
    throw new ForbiddenError(
      `Requires ${minimum} plan (current: ${sub.plan}/${sub.status})`,
      'PLAN_REQUIRED'
    )
  }
}
