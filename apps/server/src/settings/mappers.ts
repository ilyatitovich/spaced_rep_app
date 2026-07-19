import type {
  BillingProvider,
  NotificationChannel,
  NotificationReminder,
  PlanTier,
  Subscription,
  SubscriptionStatus,
  ThemePreference,
  UserLearningSettings,
  UserNotificationSettings,
  UserPreference
} from '../generated/prisma/client.js'

const THEME_TO_JSON: Record<ThemePreference, string> = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
}

const THEME_FROM_JSON: Record<string, ThemePreference> = {
  light: 'LIGHT',
  dark: 'DARK',
  system: 'SYSTEM'
}

const PLAN_TO_JSON: Record<PlanTier, string> = {
  FREE: 'free',
  PRO: 'pro',
  PRO_PLUS: 'pro_plus'
}

const STATUS_TO_JSON: Record<SubscriptionStatus, string> = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
  INCOMPLETE: 'incomplete'
}

const PROVIDER_TO_JSON: Record<BillingProvider, string> = {
  NONE: 'none',
  STRIPE: 'stripe'
}

const CHANNEL_TO_JSON: Record<NotificationChannel, string> = {
  PUSH: 'push',
  EMAIL: 'email'
}

const CHANNEL_FROM_JSON: Record<string, NotificationChannel> = {
  push: 'PUSH',
  email: 'EMAIL'
}

/** Format a Prisma @db.Time Date as HH:mm:ss. */
export function timeToHhMmSs(value: Date): string {
  const hh = String(value.getUTCHours()).padStart(2, '0')
  const mm = String(value.getUTCMinutes()).padStart(2, '0')
  const ss = String(value.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Parse HH:mm or HH:mm:ss into a Date usable for @db.Time. */
export function hhMmSsToTime(value: string): Date {
  const parts = value.split(':').map(Number)
  const [h, m, s = 0] = parts
  return new Date(Date.UTC(1970, 0, 1, h, m, s))
}

export function themeToJson(theme: ThemePreference): string {
  return THEME_TO_JSON[theme]
}

export function themeFromJson(theme: string): ThemePreference {
  const mapped = THEME_FROM_JSON[theme]
  if (!mapped) throw new Error(`Invalid theme: ${theme}`)
  return mapped
}

export function channelFromJson(channel: string): NotificationChannel {
  const mapped = CHANNEL_FROM_JSON[channel]
  if (!mapped) throw new Error(`Invalid channel: ${channel}`)
  return mapped
}

export type PreferencesDto = {
  theme: string
  language: string
  timezone: string
  updatedAt: number
  updatedByDeviceId?: string
  applied?: boolean
}

export type LearningDto = {
  weekStartsOn: number
  dailyNewCardLimit: number | null
  updatedAt: number
  updatedByDeviceId?: string
  applied?: boolean
}

export type ReminderDto = {
  id: string
  timeLocal: string
  daysOfWeek: number
  channel: string
  enabled: boolean
  sortOrder: number
  updatedAt: number
}

export type NotificationsDto = {
  enabled: boolean
  timezone: string
  reminders: ReminderDto[]
  updatedAt: number
  updatedByDeviceId?: string
  applied?: boolean
}

export type SubscriptionDto = {
  plan: string
  status: string
  provider: string
  currentPeriodEnd: number | null
  trialEndsAt: number | null
  cancelAtPeriodEnd: boolean
  serverUpdatedAt: number
}

export type SettingsDocumentDto = {
  preferences: PreferencesDto
  learning: LearningDto
  notifications: NotificationsDto
  subscription: SubscriptionDto
}

export function preferencesToDto(
  row: UserPreference,
  applied?: boolean
): PreferencesDto {
  return {
    theme: themeToJson(row.theme),
    language: row.language,
    timezone: row.timezone,
    updatedAt: row.updatedAt.getTime(),
    updatedByDeviceId: row.updatedByDeviceId ?? undefined,
    ...(applied !== undefined ? { applied } : {})
  }
}

export function learningToDto(
  row: UserLearningSettings,
  applied?: boolean
): LearningDto {
  return {
    weekStartsOn: row.weekStartsOn,
    dailyNewCardLimit: row.dailyNewCardLimit,
    updatedAt: row.updatedAt.getTime(),
    updatedByDeviceId: row.updatedByDeviceId ?? undefined,
    ...(applied !== undefined ? { applied } : {})
  }
}

export function reminderToDto(row: NotificationReminder): ReminderDto {
  return {
    id: row.id,
    timeLocal: timeToHhMmSs(row.timeLocal),
    daysOfWeek: row.daysOfWeek,
    channel: CHANNEL_TO_JSON[row.channel],
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.getTime()
  }
}

export function notificationsToDto(
  row: UserNotificationSettings,
  reminders: NotificationReminder[],
  applied?: boolean
): NotificationsDto {
  return {
    enabled: row.enabled,
    timezone: row.timezone,
    reminders: reminders
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .map(reminderToDto),
    updatedAt: row.updatedAt.getTime(),
    updatedByDeviceId: row.updatedByDeviceId ?? undefined,
    ...(applied !== undefined ? { applied } : {})
  }
}

export function subscriptionToDto(row: Subscription): SubscriptionDto {
  return {
    plan: PLAN_TO_JSON[row.plan],
    status: STATUS_TO_JSON[row.status],
    provider: PROVIDER_TO_JSON[row.provider],
    currentPeriodEnd: row.currentPeriodEnd?.getTime() ?? null,
    trialEndsAt: row.trialEndsAt?.getTime() ?? null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    serverUpdatedAt: row.serverUpdatedAt.getTime()
  }
}

/** LWW: incoming wins if newer; tie-break by deviceId. */
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
