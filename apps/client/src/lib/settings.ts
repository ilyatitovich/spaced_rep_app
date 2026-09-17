import type {
  PlanTier,
  SubscriptionSnapshot,
  SubscriptionStatus,
  ThemePreference,
  UserLearningSettings,
  UserNotificationSettings,
  UserPreferences,
  UserSettingsDocument
} from '@/types/settings.types'
import { SETTINGS_LOCAL_KEY } from '@/types/settings.types'

export function detectLanguage(): string {
  const lang = navigator.language || 'en'
  return lang.slice(0, 35)
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function defaultPreferences(now = Date.now()): UserPreferences {
  return {
    theme: 'system',
    language: detectLanguage(),
    timezone: detectTimezone(),
    updatedAt: now
  }
}

export function defaultLearning(now = Date.now()): UserLearningSettings {
  return {
    weekStartsOn: 0,
    dailyNewCardLimit: null,
    updatedAt: now
  }
}

export function defaultNotifications(
  now = Date.now()
): UserNotificationSettings {
  return {
    enabled: false,
    timezone: detectTimezone(),
    reminders: [],
    updatedAt: now
  }
}

export function defaultSubscription(now = Date.now()): SubscriptionSnapshot {
  return {
    plan: 'free',
    status: 'active',
    provider: 'none',
    currentPeriodEnd: null,
    endsAt: null,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    serverUpdatedAt: now
  }
}

export function defaultSettingsDocument(
  now = Date.now()
): UserSettingsDocument {
  return {
    preferences: defaultPreferences(now),
    learning: defaultLearning(now),
    notifications: defaultNotifications(now),
    subscription: defaultSubscription(now)
  }
}

export function shouldApplySettingsLww(
  existingUpdatedAt: number | undefined,
  existingDeviceId: string | undefined,
  incomingUpdatedAt: number,
  incomingDeviceId: string
): boolean {
  if (existingUpdatedAt === undefined) return true
  if (incomingUpdatedAt > existingUpdatedAt) return true
  if (incomingUpdatedAt < existingUpdatedAt) return false
  return incomingDeviceId.localeCompare(existingDeviceId ?? '') > 0
}

const PLAN_RANK: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  pro_plus: 2
}

const ALWAYS_ENTITLED: ReadonlySet<SubscriptionStatus> = new Set([
  'active',
  'trialing',
  'past_due'
])

function isSubscriptionEntitled(
  status: SubscriptionStatus,
  endsAt: number | null,
  now: number
): boolean {
  if (ALWAYS_ENTITLED.has(status)) return true
  if (status === 'canceled') return endsAt != null && endsAt > now
  return false
}

/** Purchased tier while entitled; free when access ended. */
export function effectivePlan(
  subscription: Pick<SubscriptionSnapshot, 'plan' | 'status' | 'endsAt'>,
  now = Date.now()
): PlanTier {
  return isSubscriptionEntitled(subscription.status, subscription.endsAt, now)
    ? subscription.plan
    : 'free'
}

export function isPlanEntitled(
  subscription: Pick<SubscriptionSnapshot, 'plan' | 'status' | 'endsAt'>,
  minimum: PlanTier,
  now = Date.now()
): boolean {
  return PLAN_RANK[effectivePlan(subscription, now)] >= PLAN_RANK[minimum]
}

export function resolveTheme(theme: ThemePreference): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}

export function applyThemeToDocument(theme: ThemePreference): void {
  const resolved = resolveTheme(theme)
  document.documentElement.dataset.theme = resolved
  document.documentElement.classList.toggle('dark', resolved === 'dark')

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0f0f0f' : '#f5f5f5')
  }
}

export { SETTINGS_LOCAL_KEY }
