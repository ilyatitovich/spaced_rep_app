import webpush from 'web-push'
import { env } from '../../shared/config/env.js'
import { prisma } from '../../shared/lib/prisma.js'
import { logger } from '../../shared/lib/logger.js'
import type { UpsertSubscriptionBody } from '../schemas/subscription.schemas.js'

webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
)

export function getVapidPublicKey(): string {
  return env.VAPID_PUBLIC_KEY
}

export async function upsertPushSubscription(
  userId: string,
  body: UpsertSubscriptionBody,
  userAgent?: string | null
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: {
      userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      deviceId: body.deviceId ?? null,
      userAgent: userAgent ?? null
    },
    update: {
      userId,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      deviceId: body.deviceId ?? null,
      userAgent: userAgent ?? null
    },
    select: { id: true, endpoint: true, deviceId: true }
  })
}

export async function deletePushSubscription(
  userId: string,
  endpoint: string
): Promise<boolean> {
  const result = await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint }
  })
  return result.count > 0
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  type?: string
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId }
  })
  if (subscriptions.length === 0) return

  const data = JSON.stringify(payload)

  await Promise.all(
    subscriptions.map(async sub => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          data,
          { TTL: 60 * 60 * 12, urgency: 'normal' }
        )
      } catch (err) {
        const statusCode =
          err && typeof err === 'object' && 'statusCode' in err
            ? Number((err as { statusCode: number }).statusCode)
            : undefined
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } })
          logger.info(
            { userId, endpoint: sub.endpoint, statusCode },
            'Removed expired push subscription'
          )
          return
        }
        logger.warn(
          { err, userId, endpoint: sub.endpoint },
          'Failed to send push notification'
        )
      }
    })
  )
}
