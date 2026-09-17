import {
  getLocalClock,
  isReminderDue,
  localDateKey,
  timeLocalToMinutes
} from './reminder-due.js'

describe('timeLocalToMinutes', () => {
  it('parses HH:mm and HH:mm:ss', () => {
    expect(timeLocalToMinutes('09:00')).toBe(9 * 60)
    expect(timeLocalToMinutes('09:00:00')).toBe(9 * 60)
    expect(timeLocalToMinutes('14:30:15')).toBe(14 * 60 + 30)
  })

  it('reads Prisma Time Date as UTC clock', () => {
    expect(timeLocalToMinutes(new Date('1970-01-01T09:15:00.000Z'))).toBe(
      9 * 60 + 15
    )
  })
})

describe('getLocalClock / localDateKey', () => {
  it('resolves UTC midnight', () => {
    const clock = getLocalClock(new Date('2026-03-15T00:00:00.000Z'), 'UTC')
    expect(clock).toMatchObject({
      year: 2026,
      month: 3,
      day: 15,
      hour: 0,
      minute: 0,
      weekday: 0
    })
    expect(localDateKey(clock)).toBe('2026-03-15')
  })

  it('shifts into Europe/Paris', () => {
    // 2026-07-15 08:00 UTC = 10:00 CEST
    const clock = getLocalClock(
      new Date('2026-07-15T08:00:00.000Z'),
      'Europe/Paris'
    )
    expect(clock.hour).toBe(10)
    expect(clock.minute).toBe(0)
    expect(clock.day).toBe(15)
  })
})

describe('isReminderDue', () => {
  const everyDay = 127

  it('is due at exact scheduled minute', () => {
    expect(
      isReminderDue({
        now: new Date('2026-03-15T09:00:00.000Z'),
        timeLocal: '09:00',
        daysOfWeek: everyDay,
        timezone: 'UTC'
      })
    ).toBe(true)
  })

  it('is due within grace window', () => {
    expect(
      isReminderDue({
        now: new Date('2026-03-15T09:10:00.000Z'),
        timeLocal: '09:00',
        daysOfWeek: everyDay,
        timezone: 'UTC'
      })
    ).toBe(true)
  })

  it('is not due before scheduled time', () => {
    expect(
      isReminderDue({
        now: new Date('2026-03-15T08:59:00.000Z'),
        timeLocal: '09:00',
        daysOfWeek: everyDay,
        timezone: 'UTC'
      })
    ).toBe(false)
  })

  it('is not due after grace window', () => {
    expect(
      isReminderDue({
        now: new Date('2026-03-15T09:11:00.000Z'),
        timeLocal: '09:00',
        daysOfWeek: everyDay,
        timezone: 'UTC'
      })
    ).toBe(false)
  })

  it('respects daysOfWeek bitmask (Sunday only)', () => {
    // 2026-03-15 is Sunday
    expect(
      isReminderDue({
        now: new Date('2026-03-15T09:00:00.000Z'),
        timeLocal: '09:00',
        daysOfWeek: 1 << 0,
        timezone: 'UTC'
      })
    ).toBe(true)
    // Monday
    expect(
      isReminderDue({
        now: new Date('2026-03-16T09:00:00.000Z'),
        timeLocal: '09:00',
        daysOfWeek: 1 << 0,
        timezone: 'UTC'
      })
    ).toBe(false)
  })

  it('uses timezone for local HH:mm', () => {
    // 08:00 UTC = 09:00 Europe/Paris (CET in March? Mar 15 2026 is still CET = UTC+1)
    expect(
      isReminderDue({
        now: new Date('2026-03-15T08:00:00.000Z'),
        timeLocal: '09:00',
        daysOfWeek: everyDay,
        timezone: 'Europe/Paris'
      })
    ).toBe(true)
  })
})
