import type {
  PlanTier,
  SubscriptionStatus
} from '../../generated/prisma/client.js'
import { prisma } from '../../shared/lib/prisma.js'
import { getRedis, tryAcquireLeaderLock } from '../../shared/lib/redis.js'
import { logger } from '../../shared/lib/logger.js'
import { notifyUser } from './notify.service.js'
import { getLocalClock, isReminderDue, localDateKey } from './reminder-due.js'
import { isPlanEntitled } from '../../settings/services/plan.service.js'

const TICK_MS = 60_000
const LEADER_LOCK_KEY = 'leader:reminder'
const LEADER_LOCK_TTL_SECONDS = 90

let timer: ReturnType<typeof setInterval> | null = null
let running = false
let idleWaiters: Array<() => void> = []

function notifyIdle(): void {
  const waiters = idleWaiters
  idleWaiters = []
  for (const resolve of waiters) resolve()
}

export function startReminderTicker(): void {
  if (timer) return
  void runReminderTick()
  timer = setInterval(() => {
    void runReminderTick()
  }, TICK_MS)
  timer.unref()
  logger.info('Reminder ticker started')
}

export function stopReminderTicker(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

/** Resolves once any in-flight tick finishes (for graceful shutdown). */
export function whenReminderTickerIdle(): Promise<void> {
  if (!running) return Promise.resolve()
  return new Promise(resolve => {
    idleWaiters.push(resolve)
  })
}

interface ReminderRow {
  id: string
  userId: string
  timeLocal: Date
  daysOfWeek: number
  channel: string
  settings: { timezone: string }
  user: {
    subscription: {
      plan: PlanTier
      status: SubscriptionStatus
      endsAt: Date | null
    } | null
  }
}

async function deliverDueReminder(rem: ReminderRow, now: Date): Promise<void> {
  const subscription = rem.user.subscription
  if (
    !subscription ||
    !isPlanEntitled(
      subscription.plan,
      subscription.status,
      'PRO',
      subscription.endsAt,
      now
    )
  ) {
    return
  }
  const timezone = rem.settings.timezone || 'UTC'
  if (
    !isReminderDue({
      now,
      timeLocal: rem.timeLocal,
      daysOfWeek: rem.daysOfWeek,
      timezone
    })
  ) {
    return
  }

  const lockKey = `notif:fired:${rem.id}:${localDateKey(getLocalClock(now, timezone))}`
  const redis = getRedis()
  if (!redis.isOpen) await redis.connect()
  const locked = await redis.set(lockKey, '1', { NX: true, EX: 86_400 })
  if (locked === null) return

  try {
    await notifyUser(
      {
        userId: rem.userId,
        type: 'study.reminder',
        title: 'Time to study',
        body: 'Your study reminder is due. Open the app to review your cards.',
        url: '/',
        channels: [rem.channel === 'EMAIL' ? 'EMAIL' : 'PUSH']
      },
      true
    )
  } catch (err) {
    logger.error({ err, reminderId: rem.id }, 'Reminder notify failed')
    await redis.del(lockKey)
  }
}

export async function runReminderTick(now = new Date()): Promise<void> {
  if (running) return
  if (!(await tryAcquireLeaderLock(LEADER_LOCK_KEY, LEADER_LOCK_TTL_SECONDS))) {
    return
  }
  running = true
  try {
    const reminders = await prisma.notificationReminder.findMany({
      where: {
        enabled: true,
        settings: { enabled: true }
      },
      select: {
        id: true,
        userId: true,
        timeLocal: true,
        daysOfWeek: true,
        channel: true,
        settings: { select: { timezone: true } },
        user: {
          select: {
            subscription: {
              select: { plan: true, status: true, endsAt: true }
            }
          }
        }
      }
    })

    for (const rem of reminders) {
      await deliverDueReminder(rem, now)
    }
  } catch (err) {
    logger.error({ err }, 'Reminder tick failed')
  } finally {
    running = false
    notifyIdle()
  }
}
