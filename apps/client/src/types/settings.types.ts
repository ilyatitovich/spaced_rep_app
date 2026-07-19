export type ThemePreference = 'light' | 'dark' | 'system'
export type PlanTier = 'free' | 'pro' | 'pro_plus'
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'incomplete'
export type NotificationChannel = 'push' | 'email'
export type BillingProvider = 'none' | 'stripe'

export type UserPreferences = {
  theme: ThemePreference
  language: string
  timezone: string
  updatedAt: number
  updatedByDeviceId?: string
}

export type UserLearningSettings = {
  weekStartsOn: number
  dailyNewCardLimit: number | null
  updatedAt: number
  updatedByDeviceId?: string
}

export type NotificationReminder = {
  id: string
  timeLocal: string
  daysOfWeek: number
  channel: NotificationChannel
  enabled: boolean
  sortOrder: number
  updatedAt: number
}

export type UserNotificationSettings = {
  enabled: boolean
  timezone: string
  reminders: NotificationReminder[]
  updatedAt: number
  updatedByDeviceId?: string
}

export type SubscriptionSnapshot = {
  plan: PlanTier
  status: SubscriptionStatus
  provider: BillingProvider
  currentPeriodEnd: number | null
  trialEndsAt: number | null
  cancelAtPeriodEnd: boolean
  serverUpdatedAt: number
}

export type UserSettingsDocument = {
  preferences: UserPreferences
  learning: UserLearningSettings
  notifications: UserNotificationSettings
  subscription: SubscriptionSnapshot
}

export type SettingsSection =
  | 'preferences'
  | 'learning'
  | 'notifications'

export type SettingsOutboxItem = {
  id: string
  section: SettingsSection
  payload: Record<string, unknown>
  opId: string
  updatedAt: number
  attempts: number
  nextRetryAt: number
}

export const SETTINGS_LOCAL_KEY = 'local'
