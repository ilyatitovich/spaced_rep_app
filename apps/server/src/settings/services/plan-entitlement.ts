import type {
  PlanTier,
  SubscriptionStatus
} from '../../generated/prisma/client.js'

const PLAN_RANK: Record<PlanTier, number> = {
  FREE: 0,
  PRO: 1,
  PRO_PLUS: 2
}

const ALWAYS_ENTITLED: ReadonlySet<SubscriptionStatus> = new Set([
  'ACTIVE',
  'TRIALING',
  'PAST_DUE'
])

/** True when provider status still grants access at `now` (ignores plan tier). */
export function isSubscriptionEntitled(
  status: SubscriptionStatus,
  endsAt: Date | null,
  now: Date = new Date()
): boolean {
  if (ALWAYS_ENTITLED.has(status)) return true
  if (status === 'CANCELED') return endsAt != null && endsAt.getTime() > now.getTime()
  return false
}

/**
 * Purchased tier while entitled; FREE when access ended.
 * Does not mutate stored plan — callers keep PRO/EXPIRED as billing history.
 */
export function effectivePlan(
  plan: PlanTier,
  status: SubscriptionStatus,
  endsAt: Date | null = null,
  now: Date = new Date()
): PlanTier {
  return isSubscriptionEntitled(status, endsAt, now) ? plan : 'FREE'
}

/** True when effective access meets the minimum tier. */
export function isPlanEntitled(
  plan: PlanTier,
  status: SubscriptionStatus,
  minimum: PlanTier,
  endsAt: Date | null = null,
  now: Date = new Date()
): boolean {
  return (
    PLAN_RANK[effectivePlan(plan, status, endsAt, now)] >= PLAN_RANK[minimum]
  )
}
