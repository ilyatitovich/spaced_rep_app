const WEEKDAY_TO_BIT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
}

const GRACE_MINUTES = 10

export type LocalClock = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
}

export function getLocalClock(now: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short'
  }).formatToParts(now)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? ''

  const weekdayName = get('weekday')
  const weekday = WEEKDAY_TO_BIT[weekdayName]
  if (weekday === undefined) {
    throw new Error(`Unexpected weekday: ${weekdayName}`)
  }

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday
  }
}

export function localDateKey(clock: LocalClock): string {
  const mm = String(clock.month).padStart(2, '0')
  const dd = String(clock.day).padStart(2, '0')
  return `${clock.year}-${mm}-${dd}`
}

/** Extract HH:mm minutes from Prisma Time (`Date`) or `HH:mm` / `HH:mm:ss` string. */
export function timeLocalToMinutes(timeLocal: Date | string): number {
  if (typeof timeLocal === 'string') {
    const [h, m] = timeLocal.split(':')
    return Number(h) * 60 + Number(m)
  }
  return timeLocal.getUTCHours() * 60 + timeLocal.getUTCMinutes()
}

/**
 * True when local clock is on an allowed weekday and within
 * [scheduled, scheduled + grace] minutes (same calendar day).
 */
export function isReminderDue(input: {
  now: Date
  timeLocal: Date | string
  daysOfWeek: number
  timezone: string
  graceMinutes?: number
}): boolean {
  const grace = input.graceMinutes ?? GRACE_MINUTES
  const clock = getLocalClock(input.now, input.timezone)

  if ((input.daysOfWeek & (1 << clock.weekday)) === 0) return false

  const scheduled = timeLocalToMinutes(input.timeLocal)
  const current = clock.hour * 60 + clock.minute
  const overdue = current - scheduled
  return overdue >= 0 && overdue <= grace
}
