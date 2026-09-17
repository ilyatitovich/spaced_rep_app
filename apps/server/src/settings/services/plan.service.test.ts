import { effectivePlan, isPlanEntitled } from './plan-entitlement.js'

const NOW = new Date('2026-06-15T12:00:00.000Z')
const FUTURE = new Date('2026-07-01T00:00:00.000Z')
const PAST = new Date('2026-06-01T00:00:00.000Z')

describe('isPlanEntitled', () => {
  it('allows free for free minimum', () => {
    expect(isPlanEntitled('FREE', 'ACTIVE', 'FREE', null, NOW)).toBe(true)
  })

  it('blocks free from pro', () => {
    expect(isPlanEntitled('FREE', 'ACTIVE', 'PRO', null, NOW)).toBe(false)
  })

  it('allows pro_plus for pro', () => {
    expect(isPlanEntitled('PRO_PLUS', 'ACTIVE', 'PRO', null, NOW)).toBe(true)
  })

  it('allows past_due on pro during dunning', () => {
    expect(isPlanEntitled('PRO', 'PAST_DUE', 'PRO', null, NOW)).toBe(true)
  })

  it('allows trialing', () => {
    expect(isPlanEntitled('PRO', 'TRIALING', 'PRO', null, NOW)).toBe(true)
  })

  it('allows canceled only while endsAt is in the future', () => {
    expect(isPlanEntitled('PRO', 'CANCELED', 'PRO', FUTURE, NOW)).toBe(true)
    expect(isPlanEntitled('PRO', 'CANCELED', 'PRO', PAST, NOW)).toBe(false)
    expect(isPlanEntitled('PRO', 'CANCELED', 'PRO', null, NOW)).toBe(false)
  })

  it('rejects expired unpaid paused and incomplete', () => {
    expect(isPlanEntitled('PRO', 'EXPIRED', 'PRO', FUTURE, NOW)).toBe(false)
    expect(isPlanEntitled('PRO', 'UNPAID', 'PRO', FUTURE, NOW)).toBe(false)
    expect(isPlanEntitled('PRO', 'PAUSED', 'PRO', FUTURE, NOW)).toBe(false)
    expect(isPlanEntitled('PRO', 'INCOMPLETE', 'PRO', FUTURE, NOW)).toBe(false)
  })
})

describe('effectivePlan', () => {
  it('preserves purchased tier while entitled', () => {
    expect(effectivePlan('PRO', 'ACTIVE', null, NOW)).toBe('PRO')
    expect(effectivePlan('PRO', 'PAST_DUE', null, NOW)).toBe('PRO')
    expect(effectivePlan('PRO', 'CANCELED', FUTURE, NOW)).toBe('PRO')
  })

  it('derives free when access has ended without overwriting purchased tier semantics', () => {
    expect(effectivePlan('PRO', 'EXPIRED', null, NOW)).toBe('FREE')
    expect(effectivePlan('PRO', 'CANCELED', PAST, NOW)).toBe('FREE')
    expect(effectivePlan('PRO', 'UNPAID', null, NOW)).toBe('FREE')
    expect(effectivePlan('PRO', 'PAUSED', null, NOW)).toBe('FREE')
  })
})
