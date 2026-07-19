import { prisma } from '../../shared/lib/prisma.js'
import {
  channelFromJson,
  hhMmSsToTime,
  learningToDto,
  notificationsToDto,
  preferencesToDto,
  shouldApplySettingsLww,
  subscriptionToDto,
  themeFromJson,
  type LearningDto,
  type NotificationsDto,
  type PreferencesDto,
  type ReminderDto,
  type SettingsDocumentDto,
  type SubscriptionDto
} from '../mappers.js'
import { ensureUserSettings } from './ensure.service.js'

export async function getSettingsDocument(
  userId: string
): Promise<SettingsDocumentDto> {
  await ensureUserSettings(userId)

  const [preferences, learning, notificationSettings, reminders, subscription] =
    await Promise.all([
      prisma.userPreference.findUniqueOrThrow({ where: { userId } }),
      prisma.userLearningSettings.findUniqueOrThrow({ where: { userId } }),
      prisma.userNotificationSettings.findUniqueOrThrow({ where: { userId } }),
      prisma.notificationReminder.findMany({ where: { userId } }),
      prisma.subscription.findUniqueOrThrow({ where: { userId } })
    ])

  return {
    preferences: preferencesToDto(preferences),
    learning: learningToDto(learning),
    notifications: notificationsToDto(notificationSettings, reminders),
    subscription: subscriptionToDto(subscription)
  }
}

export async function patchPreferences(
  userId: string,
  input: {
    theme?: string
    language?: string
    timezone?: string
    updatedAt: number
    deviceId: string
  }
): Promise<PreferencesDto> {
  await ensureUserSettings(userId)
  const existing = await prisma.userPreference.findUniqueOrThrow({
    where: { userId }
  })

  const apply = shouldApplySettingsLww(
    existing.updatedAt.getTime(),
    existing.updatedByDeviceId ?? undefined,
    input.updatedAt,
    input.deviceId
  )

  if (!apply) {
    return preferencesToDto(existing, false)
  }

  const updated = await prisma.userPreference.update({
    where: { userId },
    data: {
      ...(input.theme !== undefined
        ? { theme: themeFromJson(input.theme) }
        : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      updatedAt: new Date(input.updatedAt),
      updatedByDeviceId: input.deviceId
    }
  })

  return preferencesToDto(updated, true)
}

export async function patchLearning(
  userId: string,
  input: {
    weekStartsOn?: number
    dailyNewCardLimit?: number | null
    updatedAt: number
    deviceId: string
  }
): Promise<LearningDto> {
  await ensureUserSettings(userId)
  const existing = await prisma.userLearningSettings.findUniqueOrThrow({
    where: { userId }
  })

  const apply = shouldApplySettingsLww(
    existing.updatedAt.getTime(),
    existing.updatedByDeviceId ?? undefined,
    input.updatedAt,
    input.deviceId
  )

  if (!apply) {
    return learningToDto(existing, false)
  }

  const updated = await prisma.userLearningSettings.update({
    where: { userId },
    data: {
      ...(input.weekStartsOn !== undefined
        ? { weekStartsOn: input.weekStartsOn }
        : {}),
      ...(input.dailyNewCardLimit !== undefined
        ? { dailyNewCardLimit: input.dailyNewCardLimit }
        : {}),
      updatedAt: new Date(input.updatedAt),
      updatedByDeviceId: input.deviceId
    }
  })

  return learningToDto(updated, true)
}

export async function patchNotifications(
  userId: string,
  input: {
    enabled?: boolean
    timezone?: string
    reminders?: ReminderDto[]
    updatedAt: number
    deviceId: string
  }
): Promise<NotificationsDto> {
  await ensureUserSettings(userId)
  const existing = await prisma.userNotificationSettings.findUniqueOrThrow({
    where: { userId }
  })

  const applyMaster = shouldApplySettingsLww(
    existing.updatedAt.getTime(),
    existing.updatedByDeviceId ?? undefined,
    input.updatedAt,
    input.deviceId
  )

  await prisma.$transaction(async tx => {
    if (applyMaster) {
      await tx.userNotificationSettings.update({
        where: { userId },
        data: {
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.timezone !== undefined
            ? { timezone: input.timezone }
            : {}),
          updatedAt: new Date(input.updatedAt),
          updatedByDeviceId: input.deviceId
        }
      })
    }

    if (!input.reminders) return

    const existingReminders = await tx.notificationReminder.findMany({
      where: { userId }
    })
    const existingById = new Map(existingReminders.map(r => [r.id, r]))
    const incomingIds = new Set(input.reminders.map(r => r.id))

    for (const rem of input.reminders) {
      const prev = existingById.get(rem.id)
      const applyRow = shouldApplySettingsLww(
        prev?.updatedAt.getTime(),
        undefined,
        rem.updatedAt,
        input.deviceId
      )
      if (!applyRow) continue

      await tx.notificationReminder.upsert({
        where: { id: rem.id },
        create: {
          id: rem.id,
          userId,
          timeLocal: hhMmSsToTime(rem.timeLocal),
          daysOfWeek: rem.daysOfWeek,
          channel: channelFromJson(rem.channel),
          enabled: rem.enabled,
          sortOrder: rem.sortOrder,
          updatedAt: new Date(rem.updatedAt)
        },
        update: {
          timeLocal: hhMmSsToTime(rem.timeLocal),
          daysOfWeek: rem.daysOfWeek,
          channel: channelFromJson(rem.channel),
          enabled: rem.enabled,
          sortOrder: rem.sortOrder,
          updatedAt: new Date(rem.updatedAt)
        }
      })
    }

    // Hard-delete reminders omitted from replace payload (v1 replace-all when reminders sent)
    const toDelete = existingReminders.filter(r => !incomingIds.has(r.id))
    if (toDelete.length > 0) {
      await tx.notificationReminder.deleteMany({
        where: { userId, id: { in: toDelete.map(r => r.id) } }
      })
    }
  })

  const [settings, reminders] = await Promise.all([
    prisma.userNotificationSettings.findUniqueOrThrow({ where: { userId } }),
    prisma.notificationReminder.findMany({ where: { userId } })
  ])

  return notificationsToDto(settings, reminders, applyMaster)
}

export async function replaceReminders(
  userId: string,
  input: {
    reminders: ReminderDto[]
    updatedAt: number
    deviceId: string
  }
): Promise<NotificationsDto> {
  return patchNotifications(userId, {
    reminders: input.reminders,
    updatedAt: input.updatedAt,
    deviceId: input.deviceId
  })
}

export async function getSubscriptionDto(
  userId: string
): Promise<SubscriptionDto> {
  await ensureUserSettings(userId)
  const row = await prisma.subscription.findUniqueOrThrow({ where: { userId } })
  return subscriptionToDto(row)
}
