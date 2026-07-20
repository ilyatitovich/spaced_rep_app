import type {
  PlanTier,
  SubscriptionStatus
} from '../../generated/prisma/client.js'

const ENTITLED: SubscriptionStatus[] = ['ACTIVE', 'TRIALING']

const PLAN_RANK: Record<PlanTier, number> = {
  FREE: 0,
  PRO: 1,
  PRO_PLUS: 2
}

/** True when plan meets minimum tier and status is active/trialing. */
export function isPlanEntitled(
  plan: PlanTier,
  status: SubscriptionStatus,
  minimum: PlanTier
): boolean {
  return ENTITLED.includes(status) && PLAN_RANK[plan] >= PLAN_RANK[minimum]
}
