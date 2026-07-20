import type { PlanTier } from '../../generated/prisma/client.js'
import { ForbiddenError } from '../../shared/lib/errors.js'
import { prisma } from '../../shared/lib/prisma.js'
import { ensureUserSettings } from './ensure.service.js'
import { isPlanEntitled } from './plan-entitlement.js'

export { isPlanEntitled } from './plan-entitlement.js'

export async function getSubscription(userId: string) {
  await ensureUserSettings(userId)
  return prisma.subscription.findUniqueOrThrow({ where: { userId } })
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
