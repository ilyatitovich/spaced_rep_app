import { env } from '../../shared/config/env.js'
import { prisma } from '../../shared/lib/prisma.js'

const EPOCH = new Date(0)

/** Lazily create default settings rows for a user (idempotent). */
export async function ensureUserSettings(userId: string) {
  const plan = env.BETA_OPEN_PRO ? 'PRO' : 'FREE'
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
        plan,
        status: 'ACTIVE',
        provider: 'NONE'
      },
      // Unpaid beta: promote existing FREE rows without touching Lemon state.
      update: env.BETA_OPEN_PRO
        ? { plan: 'PRO', status: 'ACTIVE', provider: 'NONE' }
        : {}
    })
  ])
}
