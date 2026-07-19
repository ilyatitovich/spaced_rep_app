import { applyThemeToDocument, isPlanEntitled } from '@/lib/settings'
import {
  bootstrapLocalSettings,
  getSettingsMemory,
  pullAndMergeSettings,
  refreshSubscriptionCache,
  setSettingsUser,
  subscribeSettings,
  triggerSettingsFlush,
  updateNotifications,
  updatePreferences
} from '@/services/settings.service'
import type { PlanTier, UserSettingsDocument } from '@/types/settings.types'
import { create } from 'zustand'

type SettingsStore = {
  settings: UserSettingsDocument | null
  isLoading: boolean
  loadLocal: () => Promise<void>
  setUser: (userId: string | null) => void
  pullRemote: (userId: string) => Promise<void>
  setTheme: (
    theme: UserSettingsDocument['preferences']['theme']
  ) => Promise<void>
  setLanguage: (language: string) => Promise<void>
  setTimezone: (timezone: string) => Promise<void>
  setNotifications: (
    patch: Partial<
      Pick<
        UserSettingsDocument['notifications'],
        'enabled' | 'timezone' | 'reminders'
      >
    >
  ) => Promise<void>
  refreshSubscription: () => Promise<void>
  hasPlan: (minimum: PlanTier) => boolean
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: getSettingsMemory(),
  isLoading: false,
  loadLocal: async () => {
    set({ isLoading: true })
    try {
      const settings = await bootstrapLocalSettings()
      set({ settings, isLoading: false })
    } catch (error) {
      console.error('Failed to load settings:', error)
      set({ isLoading: false })
    }
  },
  setUser: userId => {
    setSettingsUser(userId)
  },
  pullRemote: async userId => {
    try {
      await pullAndMergeSettings(userId)
      set({ settings: getSettingsMemory() })
    } catch (error) {
      console.error('Failed to pull settings:', error)
    }
  },
  setTheme: async theme => {
    const settings = await updatePreferences({ theme })
    set({ settings })
  },
  setLanguage: async language => {
    const settings = await updatePreferences({ language })
    set({ settings })
  },
  setTimezone: async timezone => {
    const settings = await updatePreferences({ timezone })
    set({ settings })
  },
  setNotifications: async patch => {
    const settings = await updateNotifications(patch)
    set({ settings })
  },
  refreshSubscription: async () => {
    await refreshSubscriptionCache()
    set({ settings: getSettingsMemory() })
  },
  hasPlan: minimum => {
    const sub = get().settings?.subscription
    if (!sub) return minimum === 'free'
    return isPlanEntitled(sub, minimum)
  }
}))

subscribeSettings(settings => {
  useSettingsStore.setState({ settings })
  applyThemeToDocument(settings.preferences.theme)
})

export { triggerSettingsFlush }
