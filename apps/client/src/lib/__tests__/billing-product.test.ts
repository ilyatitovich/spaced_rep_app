import { describe, expect, it } from 'vitest'

import {
  DEFAULT_BILLING_INTERVAL,
  formatProPrice,
  isSellablePlan,
  PAYWALL_MODE,
  PRO_DEVICE_LIMIT,
  PRO_PRICES,
  SELLABLE_PLANS,
  SOFT_PAYWALL_TRIGGERS
} from '../billing-product'

describe('billing product decisions', () => {
  it('uses a soft paywall (not post-login)', () => {
    expect(PAYWALL_MODE).toBe('soft')
    expect(SOFT_PAYWALL_TRIGGERS).toEqual(['sync', 'notifications'])
  })

  it('sells Pro only and defers Pro Plus', () => {
    expect(SELLABLE_PLANS).toEqual(['pro'])
    expect(isSellablePlan('pro')).toBe(true)
    expect(isSellablePlan('pro_plus')).toBe(false)
    expect(isSellablePlan('free')).toBe(false)
  })

  it('defaults to annual Pro pricing', () => {
    expect(DEFAULT_BILLING_INTERVAL).toBe('year')
    expect(PRO_PRICES.month.amountCents).toBe(500)
    expect(PRO_PRICES.year.amountCents).toBe(4800)
    expect(formatProPrice('year')).toBe('$48/year + tax')
    expect(PRO_DEVICE_LIMIT).toBe(3)
  })
})
