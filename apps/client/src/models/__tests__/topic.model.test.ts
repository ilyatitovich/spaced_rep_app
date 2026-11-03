import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createTopic,
  getNextUpdateDate,
  reactivateTopic,
  setStartWeek
} from '@/models/topic.model'

afterEach(() => {
  vi.useRealTimers()
})

describe('setStartWeek', () => {
  it('on a Wednesday pivot leaves Sun–Tue null and Wed–Sat as days', () => {
    const wednesday = new Date(2026, 10, 4, 15, 30, 0).getTime() // Wed
    const week = setStartWeek(wednesday)

    expect(week[0]).toBeNull()
    expect(week[1]).toBeNull()
    expect(week[2]).toBeNull()
    expect(week[3]?.date).toBe(new Date(2026, 10, 4, 15, 30, 0).getTime())
    expect(week[4]?.date).toBe(new Date(2026, 10, 5, 15, 30, 0).getTime())
    expect(week[5]?.date).toBe(new Date(2026, 10, 6, 15, 30, 0).getTime())
    expect(week[6]?.date).toBe(new Date(2026, 10, 7, 15, 30, 0).getTime())
    expect(week[3]?.todayLevels).toEqual([1])
    expect(week[3]?.isDone).toBe(false)
  })
})

describe('getNextUpdateDate', () => {
  it('on a known Wednesday is the following Sunday 00:00 local', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 4, 15, 30, 0)) // Wed

    expect(getNextUpdateDate()).toBe(
      new Date(2026, 10, 8, 0, 0, 0, 0).getTime()
    )
  })
})

describe('reactivateTopic', () => {
  it('sets pivot to now, rebuilds the week, and clears isArchived', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'))

    const topic = createTopic('Archived')
    topic.pivot = 1_600_000_000_000
    topic.week = [null, null, null, null, null, null, null]
    topic.nextUpdateDate = 1_600_000_000_000
    topic.isArchived = true

    reactivateTopic(topic)

    expect(topic.isArchived).toBe(false)
    expect(topic.pivot).toBe(Date.now())
    expect(topic.week).toHaveLength(7)
    expect(topic.week.some(day => day !== null)).toBe(true)
    expect(topic.nextUpdateDate).toBeGreaterThan(Date.now())
  })
})
