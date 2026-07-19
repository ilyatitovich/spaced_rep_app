import { createClient, type RedisClientType } from 'redis'
import { env } from '../config/env.js'
import { logger } from './logger.js'
import { TooManyRequestsError } from './errors.js'

let client: RedisClientType | null = null

export function getRedis(): RedisClientType {
  if (!client) {
    client = createClient({ url: env.REDIS_URL })
    client.on('error', err => {
      logger.error({ err }, 'Redis client error')
    })
  }
  return client
}

export async function connectRedis(): Promise<void> {
  const redis = getRedis()
  if (!redis.isOpen) {
    await redis.connect()
  }
}

/** INCR + EXPIRE on first hit. Fail closed if Redis is unavailable. */
export async function enforceRateLimit(input: {
  key: string
  limit: number
  windowSeconds: number
  message?: string
}): Promise<void> {
  let count: number
  try {
    const redis = getRedis()
    if (!redis.isOpen) await redis.connect()

    count = await redis.incr(input.key)
    if (count === 1) {
      await redis.expire(input.key, input.windowSeconds)
    }
  } catch (err) {
    logger.error({ err, key: input.key }, 'Rate limit Redis failure')
    throw new TooManyRequestsError(
      'Service temporarily unavailable. Please try again later.'
    )
  }

  if (count > input.limit) {
    throw new TooManyRequestsError(
      input.message ?? 'Too many requests. Please try again later.'
    )
  }
}

/** SET NX EX — reject if cooldown already active. Fail closed on Redis errors. */
export async function enforceCooldown(input: {
  key: string
  seconds: number
  message?: string
}): Promise<void> {
  let result: string | null
  try {
    const redis = getRedis()
    if (!redis.isOpen) await redis.connect()

    result = await redis.set(input.key, '1', {
      NX: true,
      EX: input.seconds
    })
  } catch (err) {
    logger.error({ err, key: input.key }, 'Cooldown Redis failure')
    throw new TooManyRequestsError(
      'Service temporarily unavailable. Please try again later.'
    )
  }

  if (result === null) {
    throw new TooManyRequestsError(
      input.message ?? 'Please wait before requesting another code.'
    )
  }
}
