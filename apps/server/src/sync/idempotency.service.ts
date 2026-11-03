import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../shared/lib/prisma.js'
import { getRedis } from '../shared/lib/redis.js'
import { logger } from '../shared/lib/logger.js'

const IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 60 * 60
// Postgres keeps op ids longer than Redis so a device that was offline for
// weeks still gets its retries deduped.
const OPERATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

type Db = Prisma.TransactionClient | typeof prisma

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
  db?: Db
}): Promise<void> {
  const db = input.db ?? prisma
  await db.syncOperation.upsert({
    where: { userId_opId: { userId: input.userId, opId: input.opId } },
    create: {
      userId: input.userId,
      opId: input.opId,
      deviceId: input.deviceId
    },
    update: {}
  })

  // Cache only after a committed write — skip when still inside a transaction.
  if (input.db) return

  await cacheOpApplied(input.userId, input.opId)
}

export async function cacheOpApplied(
  userId: string,
  opId: string
): Promise<void> {
  try {
    const redis = getRedis()
    if (redis.isOpen) {
      await redis.set(`sync:op:${userId}:${opId}`, '1', {
        EX: IDEMPOTENCY_TTL_SECONDS
      })
    }
  } catch (err) {
    logger.warn({ err }, 'sync.idempotency redis write failed')
  }
}

export async function pruneAppliedOps(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - OPERATION_RETENTION_MS)
  try {
    await prisma.syncOperation.deleteMany({
      where: { userId, appliedAt: { lt: cutoff } }
    })
  } catch (err) {
    logger.warn({ err }, 'sync.idempotency prune failed')
  }
}
