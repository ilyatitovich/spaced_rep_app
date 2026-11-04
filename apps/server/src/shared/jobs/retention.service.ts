import { logger } from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'
import { tryAcquireLeaderLock } from '../lib/redis.js'

export const RETENTION_SECURITY_EVENT_DAYS = 90
export const RETENTION_BILLING_EVENT_DAYS = 90
export const RETENTION_REVOKED_SESSION_DAYS = 7

const LEADER_LOCK_KEY = 'leader:retention'
const LEADER_LOCK_TTL_SECONDS = 25 * 60 * 60
const INTERVAL_MS = 24 * 60 * 60 * 1_000

let timer: ReturnType<typeof setInterval> | null = null
let running = false
let idleWaiters: Array<() => void> = []

function notifyIdle(): void {
  const waiters = idleWaiters
  idleWaiters = []
  for (const resolve of waiters) resolve()
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000)
}

export async function runRetentionJob(now = new Date()): Promise<void> {
  if (running) return
  if (!(await tryAcquireLeaderLock(LEADER_LOCK_KEY, LEADER_LOCK_TTL_SECONDS))) {
    return
  }
  running = true
  try {
    const revokedBefore = daysAgo(now, RETENTION_REVOKED_SESSION_DAYS)
    const securityBefore = daysAgo(now, RETENTION_SECURITY_EVENT_DAYS)
    const billingBefore = daysAgo(now, RETENTION_BILLING_EVENT_DAYS)

    const [sessions, refreshTokens, securityEvents, billingEvents, checkouts] =
      await Promise.all([
        prisma.session.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { revokedAt: { lt: revokedBefore } }
            ]
          }
        }),
        prisma.refreshToken.deleteMany({
          where: { expiresAt: { lt: now } }
        }),
        prisma.securityEvent.deleteMany({
          where: { createdAt: { lt: securityBefore } }
        }),
        prisma.billingEvent.deleteMany({
          where: { createdAt: { lt: billingBefore } }
        }),
        prisma.billingCheckoutIntent.deleteMany({
          where: { expiresAt: { lt: now } }
        })
      ])

    logger.info(
      {
        sessions: sessions.count,
        refreshTokens: refreshTokens.count,
        securityEvents: securityEvents.count,
        billingEvents: billingEvents.count,
        checkouts: checkouts.count
      },
      'Retention job completed'
    )
  } catch (err) {
    logger.error({ err }, 'Retention job failed')
  } finally {
    running = false
    notifyIdle()
  }
}

export function startRetentionJob(): void {
  if (timer) return
  void runRetentionJob()
  timer = setInterval(() => {
    void runRetentionJob()
  }, INTERVAL_MS)
  timer.unref()
  logger.info('Retention job started')
}

export function stopRetentionJob(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

export function whenRetentionJobIdle(): Promise<void> {
  if (!running) return Promise.resolve()
  return new Promise(resolve => {
    idleWaiters.push(resolve)
  })
}
