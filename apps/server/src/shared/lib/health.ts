import { prisma } from './prisma.js'
import { getRedis } from './redis.js'

export interface LivenessStatus {
  status: 'ok'
}

export interface ReadinessStatus {
  status: 'ok' | 'unhealthy'
  postgres: 'up' | 'down'
  redis: 'up' | 'down'
}

/** Process is up. Does not probe dependencies — use for restart/liveness probes. */
export async function checkLiveness(): Promise<LivenessStatus> {
  return { status: 'ok' }
}

/** Can serve traffic: Postgres and Redis respond. */
export async function checkReadiness(): Promise<ReadinessStatus> {
  let postgres: 'up' | 'down' = 'down'
  let redis: 'up' | 'down' = 'down'

  try {
    await prisma.$queryRaw`SELECT 1`
    postgres = 'up'
  } catch {
    postgres = 'down'
  }

  try {
    const client = getRedis()
    if (!client.isOpen) await client.connect()
    const pong = await client.ping()
    if (pong === 'PONG') redis = 'up'
  } catch {
    redis = 'down'
  }

  const status = postgres === 'up' && redis === 'up' ? 'ok' : 'unhealthy'
  return { status, postgres, redis }
}

/** @deprecated Prefer checkReadiness — kept for callers that still say "health". */
export const checkHealth = checkReadiness
export type HealthStatus = ReadinessStatus
