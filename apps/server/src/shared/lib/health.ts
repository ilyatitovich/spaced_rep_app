import { prisma } from './prisma.js'
import { getRedis } from './redis.js'

export interface HealthStatus {
  status: 'ok' | 'unhealthy'
  postgres: 'up' | 'down'
  redis: 'up' | 'down'
}

export async function checkHealth(): Promise<HealthStatus> {
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
