export type ThemePreference = 'light' | 'dark' | 'system'
export type PlanTier = 'free' | 'pro' | 'pro_plus'
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'incomplete'
  | 'paused'
  | 'unpaid'
export type NotificationChannel = 'push' | 'email'
export type BillingProvider = 'none' | 'stripe' | 'lemon_squeezy'

export interface UserPreferences {
  theme: ThemePreference
  language: string
  timezone: string
  updatedAt: number
  updatedByDeviceId?: string | undefined
}

export interface UserLearningSettings {
  weekStartsOn: number
  dailyNewCardLimit: number | null
  updatedAt: number
  updatedByDeviceId?: string | undefined
}

export interface NotificationReminder {
  id: string
  timeLocal: string
  daysOfWeek: number
  channel: NotificationChannel
  enabled: boolean
  sortOrder: number
  updatedAt: number
}

export interface UserNotificationSettings {
  enabled: boolean
  timezone: string
  reminders: NotificationReminder[]
  updatedAt: number
  updatedByDeviceId?: string | undefined
}

export interface SubscriptionSnapshot {
  plan: PlanTier
  status: SubscriptionStatus
  provider: BillingProvider
  currentPeriodEnd: number | null
  endsAt: number | null
  trialEndsAt: number | null
  cancelAtPeriodEnd: boolean
  serverUpdatedAt: number
}

export interface UserSettingsDocument {
  preferences: UserPreferences
  learning: UserLearningSettings
  notifications: UserNotificationSettings
  subscription: SubscriptionSnapshot
}

export type SettingsSection = 'preferences' | 'learning' | 'notifications'

export interface SettingsOutboxItem {
  id: string
  section: SettingsSection
  payload: Record<string, unknown>
  opId: string
  updatedAt: number
  attempts: number
  nextRetryAt: number
}

export const SETTINGS_LOCAL_KEY = 'local'
