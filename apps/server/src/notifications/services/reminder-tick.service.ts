import { prisma } from '../../shared/lib/prisma.js'
import { getRedis } from '../../shared/lib/redis.js'
import { logger } from '../../shared/lib/logger.js'
import { notifyUser } from './notify.service.js'
import {
  getLocalClock,
  isReminderDue,
  localDateKey
} from './reminder-due.js'

const TICK_MS = 60_000

let timer: ReturnType<typeof setInterval> | null = null
let running = false

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

export async function runReminderTick(now = new Date()): Promise<void> {
  if (running) return
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
        settings: { select: { timezone: true } }
      }
    })

    for (const rem of reminders) {
      const timezone = rem.settings.timezone || 'UTC'
      if (
        !isReminderDue({
          now,
          timeLocal: rem.timeLocal,
          daysOfWeek: rem.daysOfWeek,
          timezone
        })
      ) {
        continue
      }

      const clock = getLocalClock(now, timezone)
      const dateKey = localDateKey(clock)
      const lockKey = `notif:fired:${rem.id}:${dateKey}`

      const redis = getRedis()
      if (!redis.isOpen) await redis.connect()
      const locked = await redis.set(lockKey, '1', { NX: true, EX: 86_400 })
      if (locked === null) continue

      try {
        await notifyUser({
          userId: rem.userId,
          type: 'study.reminder',
          title: 'Time to study',
          body: 'Your study reminder is due. Open the app to review your cards.',
          url: '/',
          channels: [rem.channel === 'EMAIL' ? 'EMAIL' : 'PUSH']
        })
      } catch (err) {
        logger.error({ err, reminderId: rem.id }, 'Reminder notify failed')
        await redis.del(lockKey)
      }
    }
  } catch (err) {
    logger.error({ err }, 'Reminder tick failed')
  } finally {
    running = false
  }
}
