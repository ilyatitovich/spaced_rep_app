import type { PlanTier } from '@/types/settings.types'

export type BillingInterval = 'month' | 'year'

/**
 * Soft paywall: signed-in Free accounts keep the local app.
 * Prompt only when enabling sync or notifications — never a post-login modal.
 */
export const PAYWALL_MODE = 'soft' as const

export const SOFT_PAYWALL_TRIGGERS = ['sync', 'notifications'] as const

/** v1 sells Pro only. pro_plus stays in types for entitlement rank; not offered. */
export const SELLABLE_PLANS = ['pro'] as const satisfies readonly PlanTier[]

/** Annual is the default UI / checkout selection. */
export const DEFAULT_BILLING_INTERVAL: BillingInterval = 'year'

export const PRO_PRICES = {
  month: { amountCents: 500, display: '$5', periodLabel: 'month' },
  year: { amountCents: 4800, display: '$48', periodLabel: 'year' }
} as const

export const PRO_DEVICE_LIMIT = 3

export const BILLING_INTERVAL_OPTIONS: {
  value: BillingInterval
  label: string
}[] = [
  { value: 'year', label: '$48 / year' },
  { value: 'month', label: '$5 / month' }
]

export function isSellablePlan(plan: PlanTier): boolean {
  return (SELLABLE_PLANS as readonly string[]).includes(plan)
}

export function formatProPrice(interval: BillingInterval): string {
  const price = PRO_PRICES[interval]
  return `${price.display}/${price.periodLabel} + tax`
}
