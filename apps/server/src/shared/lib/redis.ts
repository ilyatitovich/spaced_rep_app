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

/** Atomic INCR + EXPIRE via Lua. Fail closed if Redis is unavailable. */
const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`

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

    count = (await redis.eval(RATE_LIMIT_SCRIPT, {
      keys: [input.key],
      arguments: [String(input.windowSeconds)]
    })) as number
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

/**
 * Soft leader lock for background loops. Returns true if this process should run.
 * On Redis errors, returns false so replicas do not all stampede.
 */
export async function tryAcquireLeaderLock(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  try {
    const redis = getRedis()
    if (!redis.isOpen) await redis.connect()
    const result = await redis.set(key, '1', { NX: true, EX: ttlSeconds })
    return result === 'OK'
  } catch (err) {
    logger.error({ err, key }, 'Leader lock Redis failure')
    return false
  }
}
