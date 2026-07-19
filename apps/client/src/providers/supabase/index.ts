import { ApiError } from '@/lib/api'
import { defaultSubscription } from '@/lib/settings'
import { supabase } from '@/lib/supabase'
import type {
  NotificationChannel,
  NotificationReminder,
  PlanTier,
  SubscriptionSnapshot,
  SubscriptionStatus,
  BillingProvider,
  ThemePreference,
  UserLearningSettings,
  UserNotificationSettings,
  UserPreferences,
  UserSettingsDocument
} from '@/types/settings.types'
import type { AuthPort, SettingsPort } from '../types'

async function requireUserId(auth: AuthPort): Promise<string> {
  const user = await auth.getCurrentUser()
  if (!user) throw new ApiError(401, 'Not authenticated', 'UNAUTHORIZED')
  return user.id
}

function themeFromDb(v: string): ThemePreference {
  return v.toLowerCase() as ThemePreference
}

function themeToDb(v: ThemePreference): string {
  return v.toUpperCase()
}

function planFromDb(v: string): PlanTier {
  return v.toLowerCase() as PlanTier
}

function statusFromDb(v: string): SubscriptionStatus {
  return v.toLowerCase() as SubscriptionStatus
}

function providerFromDb(v: string): BillingProvider {
  return v.toLowerCase() as BillingProvider
}

function channelFromDb(v: string): NotificationChannel {
  return v.toLowerCase() as NotificationChannel
}

function channelToDb(v: NotificationChannel): string {
  return v.toUpperCase()
}

function ms(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : Date.now()
}

function iso(msValue: number): string {
  return new Date(msValue).toISOString()
}

export function createSupabaseSettingsAdapter(auth: AuthPort): SettingsPort {
  return {
    async fetchSettings(): Promise<UserSettingsDocument> {
      const userId = await requireUserId(auth)

      const [
        prefsRes,
        learningRes,
        notifRes,
        remindersRes,
        subRes
      ] = await Promise.all([
        supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_learning_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_notification_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('notification_reminders')
          .select('*')
          .eq('user_id', userId)
          .order('sort_order'),
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
      ])

      for (const res of [prefsRes, learningRes, notifRes, remindersRes, subRes]) {
        if (res.error) throw new ApiError(500, res.error.message)
      }

      const now = Date.now()
      const prefs = prefsRes.data
      const learning = learningRes.data
      const notif = notifRes.data
      const reminders = (remindersRes.data ?? []) as Array<{
        id: string
        time_local: string
        days_of_week: number
        channel: string
        enabled: boolean
        sort_order: number
        updated_at: string
      }>
      const sub = subRes.data

      const preferences: UserPreferences = prefs
        ? {
            theme: themeFromDb(prefs.theme as string),
            language: prefs.language as string,
            timezone: prefs.timezone as string,
            updatedAt: ms(prefs.updated_at as string),
            updatedByDeviceId: (prefs.updated_by_device_id as string) ?? undefined
          }
        : {
            theme: 'system',
            language: 'en',
            timezone: 'UTC',
            updatedAt: now
          }

      const learningSettings: UserLearningSettings = learning
        ? {
            weekStartsOn: learning.week_starts_on as number,
            dailyNewCardLimit: (learning.daily_new_card_limit as number) ?? null,
            updatedAt: ms(learning.updated_at as string),
            updatedByDeviceId:
              (learning.updated_by_device_id as string) ?? undefined
          }
        : {
            weekStartsOn: 0,
            dailyNewCardLimit: null,
            updatedAt: now
          }

      const notifications: UserNotificationSettings = {
        enabled: (notif?.enabled as boolean) ?? false,
        timezone: (notif?.timezone as string) ?? 'UTC',
        updatedAt: notif ? ms(notif.updated_at as string) : now,
        updatedByDeviceId: (notif?.updated_by_device_id as string) ?? undefined,
        reminders: reminders.map(
          (r): NotificationReminder => ({
            id: r.id,
            timeLocal: String(r.time_local).slice(0, 8),
            daysOfWeek: r.days_of_week,
            channel: channelFromDb(r.channel),
            enabled: r.enabled,
            sortOrder: r.sort_order,
            updatedAt: ms(r.updated_at)
          })
        )
      }

      const subscription: SubscriptionSnapshot = sub
        ? {
            plan: planFromDb(sub.plan as string),
            status: statusFromDb(sub.status as string),
            provider: providerFromDb(sub.provider as string),
            currentPeriodEnd: sub.current_period_end
              ? ms(sub.current_period_end as string)
              : null,
            trialEndsAt: sub.trial_ends_at
              ? ms(sub.trial_ends_at as string)
              : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end as boolean,
            serverUpdatedAt: ms(sub.server_updated_at as string)
          }
        : defaultSubscription(now)

      return {
        preferences,
        learning: learningSettings,
        notifications,
        subscription
      }
    },

    async fetchSubscription() {
      const doc = await this.fetchSettings()
      return doc.subscription
    },

    async patchPreferences(body) {
      const userId = await requireUserId(auth)
      const { data: existing } = await supabase
        .from('user_preferences')
        .select('updated_at, updated_by_device_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (
        existing &&
        ms(existing.updated_at as string) > body.updatedAt
      ) {
        const doc = await this.fetchSettings()
        return { ...doc.preferences, applied: false }
      }

      const row = {
        user_id: userId,
        theme: themeToDb(body.theme ?? 'system'),
        language: body.language ?? 'en',
        timezone: body.timezone ?? 'UTC',
        updated_at: iso(body.updatedAt),
        updated_by_device_id: body.deviceId
      }

      const { error } = await supabase.from('user_preferences').upsert(row)
      if (error) throw new ApiError(500, error.message)

      return {
        theme: body.theme ?? 'system',
        language: body.language ?? 'en',
        timezone: body.timezone ?? 'UTC',
        updatedAt: body.updatedAt,
        updatedByDeviceId: body.deviceId,
        applied: true
      }
    },

    async patchLearning(body) {
      const userId = await requireUserId(auth)
      const { data: existing } = await supabase
        .from('user_learning_settings')
        .select('updated_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (existing && ms(existing.updated_at as string) > body.updatedAt) {
        const doc = await this.fetchSettings()
        return { ...doc.learning, applied: false }
      }

      const row = {
        user_id: userId,
        week_starts_on: body.weekStartsOn ?? 0,
        daily_new_card_limit: body.dailyNewCardLimit ?? null,
        updated_at: iso(body.updatedAt),
        updated_by_device_id: body.deviceId
      }

      const { error } = await supabase
        .from('user_learning_settings')
        .upsert(row)
      if (error) throw new ApiError(500, error.message)

      return {
        weekStartsOn: body.weekStartsOn ?? 0,
        dailyNewCardLimit: body.dailyNewCardLimit ?? null,
        updatedAt: body.updatedAt,
        updatedByDeviceId: body.deviceId,
        applied: true
      }
    },

    async patchNotifications(body) {
      const userId = await requireUserId(auth)
      const { data: existing } = await supabase
        .from('user_notification_settings')
        .select('updated_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (existing && ms(existing.updated_at as string) > body.updatedAt) {
        const doc = await this.fetchSettings()
        return { ...doc.notifications, applied: false }
      }

      const settingsRow = {
        user_id: userId,
        enabled: body.enabled ?? false,
        timezone: body.timezone ?? 'UTC',
        updated_at: iso(body.updatedAt),
        updated_by_device_id: body.deviceId
      }

      const { error: settingsError } = await supabase
        .from('user_notification_settings')
        .upsert(settingsRow)
      if (settingsError) throw new ApiError(500, settingsError.message)

      if (body.reminders) {
        await supabase
          .from('notification_reminders')
          .delete()
          .eq('user_id', userId)

        if (body.reminders.length > 0) {
          const rows = body.reminders.map(r => ({
            id: r.id,
            user_id: userId,
            time_local: r.timeLocal,
            days_of_week: r.daysOfWeek,
            channel: channelToDb(r.channel),
            enabled: r.enabled,
            sort_order: r.sortOrder,
            updated_at: iso(r.updatedAt)
          }))
          const { error: remError } = await supabase
            .from('notification_reminders')
            .insert(rows)
          if (remError) throw new ApiError(500, remError.message)
        }
      }

      const doc = await this.fetchSettings()
      return { ...doc.notifications, applied: true }
    }
  }
}
