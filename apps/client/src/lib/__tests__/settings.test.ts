import {
  effectivePlan,
  isPlanEntitled,
  shouldApplySettingsLww
} from '@/lib/settings'
import type { SubscriptionSnapshot } from '@/types/settings.types'

describe('shouldApplySettingsLww', () => {
  it('applies when existing is missing', () => {
    expect(shouldApplySettingsLww(undefined, undefined, 100, 'd1')).toBe(true)
  })

  it('applies when incoming is newer', () => {
    expect(shouldApplySettingsLww(100, 'd1', 200, 'd2')).toBe(true)
  })

  it('rejects when incoming is older', () => {
    expect(shouldApplySettingsLww(200, 'd1', 100, 'd2')).toBe(false)
  })

  it('tie-breaks by deviceId', () => {
    expect(shouldApplySettingsLww(100, 'aaa', 100, 'bbb')).toBe(true)
    expect(shouldApplySettingsLww(100, 'bbb', 100, 'aaa')).toBe(false)
  })
})

describe('isPlanEntitled', () => {
  const now = Date.parse('2026-06-15T12:00:00.000Z')
  const future = Date.parse('2026-07-01T00:00:00.000Z')
  const past = Date.parse('2026-06-01T00:00:00.000Z')

  const base: SubscriptionSnapshot = {
    plan: 'free',
    status: 'active',
    provider: 'none',
    currentPeriodEnd: null,
    endsAt: null,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    serverUpdatedAt: 0
  }

  it('allows free for free', () => {
    expect(isPlanEntitled(base, 'free', now)).toBe(true)
  })

  it('blocks free from pro', () => {
    expect(isPlanEntitled(base, 'pro', now)).toBe(false)
  })

  it('allows pro_plus for pro when active', () => {
    expect(
      isPlanEntitled({ ...base, plan: 'pro_plus', status: 'active' }, 'pro', now)
    ).toBe(true)
  })

  it('allows past_due during dunning', () => {
    expect(
      isPlanEntitled({ ...base, plan: 'pro', status: 'past_due' }, 'pro', now)
    ).toBe(true)
  })

  it('allows canceled only while endsAt is in the future', () => {
    expect(
      isPlanEntitled(
        { ...base, plan: 'pro', status: 'canceled', endsAt: future },
        'pro',
        now
      )
    ).toBe(true)
    expect(
      isPlanEntitled(
        { ...base, plan: 'pro', status: 'canceled', endsAt: past },
        'pro',
        now
      )
    ).toBe(false)
  })

  it('rejects expired unpaid paused', () => {
    expect(
      isPlanEntitled({ ...base, plan: 'pro', status: 'expired' }, 'pro', now)
    ).toBe(false)
    expect(
      isPlanEntitled({ ...base, plan: 'pro', status: 'unpaid' }, 'pro', now)
    ).toBe(false)
    expect(
      isPlanEntitled({ ...base, plan: 'pro', status: 'paused' }, 'pro', now)
    ).toBe(false)
  })
})

describe('effectivePlan', () => {
  const now = Date.parse('2026-06-15T12:00:00.000Z')

  it('derives free after expiry while purchased plan stays pro in the snapshot', () => {
    const expired: SubscriptionSnapshot = {
      plan: 'pro',
      status: 'expired',
      provider: 'lemon_squeezy',
      currentPeriodEnd: null,
      endsAt: null,
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
      serverUpdatedAt: 0
    }
    expect(expired.plan).toBe('pro')
    expect(effectivePlan(expired, now)).toBe('free')
  })
})
