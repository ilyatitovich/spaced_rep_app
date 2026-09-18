import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getReviewMessage } from '../get-next-review-message'

function daysAgo(days: number): number {
  const d = new Date(2026, 0, 5)
  d.setDate(d.getDate() - days)
  return d.getTime()
}

describe('getReviewMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 5, 15, 30, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const pivotToday = new Date(2026, 0, 5).getTime()

  it('returns empty for draft cards', () => {
    expect(getReviewMessage(pivotToday, 0, false)).toBe('')
  })

  it('treats level 1 as today or tomorrow', () => {
    expect(getReviewMessage(pivotToday, 1, false)).toBe('today')
    expect(getReviewMessage(pivotToday, 1, true)).toBe('tomorrow')
  })

  it('shows today when this level is due and not reviewed yet', () => {
    // Cycle day 1 is [2, 1]
    expect(getReviewMessage(daysAgo(1), 2, false)).toBe('today')
  })

  it('skips today after this level was reviewed', () => {
    // Cycle day 1 is [2, 1]; next [2, …] is cycle day 3 → 7 Jan
    expect(getReviewMessage(daysAgo(1), 2, true)).toBe('07.01.26')
  })

  it('shows the next scheduled day when this level is not due today', () => {
    // Cycle day 0 is [1]; level 2 first appears tomorrow, level 4 on day 4
    expect(getReviewMessage(pivotToday, 2, false)).toBe('tomorrow')
    expect(getReviewMessage(pivotToday, 4, false)).toBe('09.01.26')
  })

  it('still finds the next day after the 64-day cycle wraps', () => {
    // 70 days → cycle day 6 [3, 1]; next level 2 is day 7
    expect(getReviewMessage(daysAgo(70), 2, false)).toBe('tomorrow')
  })

  it('finds level 7 in the next cycle after its only slot has passed', () => {
    // Cycle day 60 is [5, 1]; next 7 is day 56 of the following cycle (60 days)
    expect(getReviewMessage(daysAgo(60), 7, false)).toBe('06.03.26')
  })

  it('shows today for level 7 on an old topic when that slot is due', () => {
    // 120 days → cycle day 56 [7, 1]
    expect(getReviewMessage(daysAgo(120), 7, false)).toBe('today')
    expect(getReviewMessage(daysAgo(120), 7, true)).toBe('10.03.26')
  })
})
