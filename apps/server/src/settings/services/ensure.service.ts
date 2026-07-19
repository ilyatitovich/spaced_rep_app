import { prisma } from '../../shared/lib/prisma.js'

const EPOCH = new Date(0)

/** Lazily create default settings rows for a user (idempotent). */
export async function ensureUserSettings(userId: string) {
  await prisma.$transaction([
    prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        theme: 'SYSTEM',
        language: 'en',
        timezone: 'UTC',
        updatedAt: EPOCH
      },
      update: {}
    }),
    prisma.userLearningSettings.upsert({
      where: { userId },
      create: {
        userId,
        weekStartsOn: 0,
        dailyNewCardLimit: null,
        updatedAt: EPOCH
      },
      update: {}
    }),
    prisma.userNotificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        enabled: false,
        timezone: 'UTC',
        updatedAt: EPOCH
      },
      update: {}
    }),
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'FREE',
        status: 'ACTIVE',
        provider: 'NONE'
      },
      update: {}
    })
  ])
}
