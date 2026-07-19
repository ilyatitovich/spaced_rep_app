import { isPlanEntitled, shouldApplySettingsLww } from '@/lib/settings'
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
  const base: SubscriptionSnapshot = {
    plan: 'free',
    status: 'active',
    provider: 'none',
    currentPeriodEnd: null,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    serverUpdatedAt: 0
  }

  it('allows free for free', () => {
    expect(isPlanEntitled(base, 'free')).toBe(true)
  })

  it('blocks free from pro', () => {
    expect(isPlanEntitled(base, 'pro')).toBe(false)
  })

  it('allows pro_plus for pro when active', () => {
    expect(
      isPlanEntitled({ ...base, plan: 'pro_plus', status: 'active' }, 'pro')
    ).toBe(true)
  })

  it('rejects past_due', () => {
    expect(
      isPlanEntitled({ ...base, plan: 'pro', status: 'past_due' }, 'pro')
    ).toBe(false)
  })
})
