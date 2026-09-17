import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  notificationReminder: {
    findMany: vi.fn()
  }
}
vi.mock('../../shared/lib/prisma.js', () => ({ prisma }))

const redis = {
  isOpen: true,
  connect: vi.fn(),
  set: vi.fn(),
  del: vi.fn()
}
vi.mock('../../shared/lib/redis.js', () => ({
  getRedis: () => redis
}))
vi.mock('../../shared/lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() }
}))

const notifyUser = vi.fn()
vi.mock('./notify.service.js', () => ({ notifyUser }))
vi.mock('./reminder-due.js', () => ({
  getLocalClock: () => ({ year: 2026, month: 9, day: 17 }),
  isReminderDue: () => true,
  localDateKey: () => '2026-09-17'
}))

const { runReminderTick } = await import('./reminder-tick.service.js')

function reminder(status: string) {
  return {
    id: `reminder-${status}`,
    userId: `user-${status}`,
    timeLocal: new Date('1970-01-01T09:00:00.000Z'),
    daysOfWeek: 127,
    channel: 'PUSH',
    settings: { timezone: 'UTC' },
    user: {
      subscription: {
        plan: 'PRO',
        status,
        endsAt: null
      }
    }
  }
}

describe('runReminderTick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    redis.set.mockResolvedValue('OK')
  })

  it('filters entitlement in one query and only delivers eligible reminders', async () => {
    prisma.notificationReminder.findMany.mockResolvedValue([
      reminder('EXPIRED'),
      reminder('ACTIVE')
    ])

    await runReminderTick(new Date('2026-09-17T09:00:00.000Z'))

    expect(prisma.notificationReminder.findMany).toHaveBeenCalledOnce()
    expect(notifyUser).toHaveBeenCalledOnce()
    expect(notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-ACTIVE' }),
      true
    )
  })
})
