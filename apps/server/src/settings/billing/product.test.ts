import {
  DEFAULT_BILLING_INTERVAL,
  isSellablePlan,
  PAYWALL_MODE,
  PRO_DEVICE_LIMIT,
  PRO_PRICES,
  SELLABLE_PLANS,
  SOFT_PAYWALL_TRIGGERS
} from './product.js'

describe('billing product decisions', () => {
  it('uses a soft paywall (not post-login)', () => {
    expect(PAYWALL_MODE).toBe('soft')
    expect(SOFT_PAYWALL_TRIGGERS).toEqual(['sync', 'notifications'])
  })

  it('sells Pro only and defers Pro Plus', () => {
    expect(SELLABLE_PLANS).toEqual(['PRO'])
    expect(isSellablePlan('PRO')).toBe(true)
    expect(isSellablePlan('PRO_PLUS')).toBe(false)
    expect(isSellablePlan('FREE')).toBe(false)
  })

  it('defaults to annual Pro pricing', () => {
    expect(DEFAULT_BILLING_INTERVAL).toBe('year')
    expect(PRO_PRICES.month.amountCents).toBe(500)
    expect(PRO_PRICES.year.amountCents).toBe(4800)
    expect(PRO_DEVICE_LIMIT).toBe(3)
  })
})
