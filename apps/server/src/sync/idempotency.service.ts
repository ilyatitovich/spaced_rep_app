import { prisma } from '../shared/lib/prisma.js'
import { getRedis } from '../shared/lib/redis.js'
import { logger } from '../shared/lib/logger.js'

const IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 60 * 60

export async function wasOpApplied(
  userId: string,
  opId: string
): Promise<boolean> {
  try {
    const redis = getRedis()
    if (redis.isOpen) {
      const hit = await redis.get(`sync:op:${userId}:${opId}`)
      if (hit) return true
    }
  } catch (err) {
    logger.warn({ err }, 'sync.idempotency redis read failed')
  }

  const row = await prisma.syncOperation.findUnique({
    where: { userId_opId: { userId, opId } },
    select: { id: true }
  })
  return Boolean(row)
}

export async function markOpApplied(input: {
  userId: string
  opId: string
  deviceId: string
}): Promise<void> {
  await prisma.syncOperation.upsert({
    where: { userId_opId: { userId: input.userId, opId: input.opId } },
    create: {
      userId: input.userId,
      opId: input.opId,
      deviceId: input.deviceId
    },
    update: {}
  })

  try {
    const redis = getRedis()
    if (redis.isOpen) {
      await redis.set(`sync:op:${input.userId}:${input.opId}`, '1', {
        EX: IDEMPOTENCY_TTL_SECONDS
      })
    }
  } catch (err) {
    logger.warn({ err }, 'sync.idempotency redis write failed')
  }
}
