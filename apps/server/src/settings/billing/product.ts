import type { PlanTier } from '../../generated/prisma/client.js'

export type BillingInterval = 'month' | 'year'

/**
 * Soft paywall: signed-in Free accounts keep the local app.
 * Prompt only when enabling sync or notifications — never a post-login modal.
 */
export const PAYWALL_MODE = 'soft' as const

export const SOFT_PAYWALL_TRIGGERS = ['sync', 'notifications'] as const

/** v1 Lemon SKU is Pro only. Keep PRO_PLUS in schema/rank; do not sell it yet. */
export const SELLABLE_PLANS = ['PRO'] as const satisfies readonly PlanTier[]

/** Annual is the default checkout / UI selection (better net after Lemon fees). */
export const DEFAULT_BILLING_INTERVAL: BillingInterval = 'year'

export const PRO_PRICES = {
  month: { amountCents: 500, display: '$5' },
  year: { amountCents: 4800, display: '$48' }
} as const

export const PRO_DEVICE_LIMIT = 3

export function isSellablePlan(plan: PlanTier): boolean {
  return (SELLABLE_PLANS as readonly string[]).includes(plan)
}
