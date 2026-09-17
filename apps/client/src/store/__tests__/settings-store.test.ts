import { beforeEach, describe, expect, it, vi } from 'vitest'

const refreshSubscriptionCache = vi.fn()
vi.mock('@/services/settings.service', () => ({
  bootstrapLocalSettings: vi.fn(),
  getSettingsMemory: () => null,
  pullAndMergeSettings: vi.fn(),
  refreshSubscriptionCache,
  setSettingsUser: vi.fn(),
  subscribeSettings: vi.fn(),
  triggerSettingsFlush: vi.fn(),
  updateNotifications: vi.fn(),
  updatePreferences: vi.fn()
}))

const initialSync = vi.fn()
const setSyncEntitlement = vi.fn()
vi.mock('@/services/sync.service', () => ({
  initialSync,
  setSyncEntitlement
}))

const { useSettingsStore } = await import('../settings-store')

function subscription(plan: 'free' | 'pro') {
  return {
    plan,
    status: 'active' as const,
    provider: plan === 'pro' ? ('lemon_squeezy' as const) : ('none' as const),
    currentPeriodEnd: null,
    endsAt: null,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    serverUpdatedAt: Date.now()
  }
}

describe('subscription sync activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ userId: null, settings: null })
  })

  it('keeps signed-in Free users paused without starting initial sync', async () => {
    refreshSubscriptionCache.mockResolvedValue(subscription('free'))
    setSyncEntitlement.mockReturnValue(false)
    useSettingsStore.getState().setUser('user-1')

    await useSettingsStore.getState().refreshSubscription()

    expect(setSyncEntitlement).toHaveBeenCalledWith(false)
    expect(initialSync).not.toHaveBeenCalled()
  })

  it('starts initial sync once entitlement activates', async () => {
    refreshSubscriptionCache.mockResolvedValue(subscription('pro'))
    setSyncEntitlement.mockReturnValue(true)
    useSettingsStore.getState().setUser('user-1')

    await useSettingsStore.getState().refreshSubscription()

    expect(setSyncEntitlement).toHaveBeenCalledWith(true)
    expect(initialSync).toHaveBeenCalledWith('user-1')
  })
})
