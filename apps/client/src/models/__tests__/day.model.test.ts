import { describe, expect, it } from 'vitest'

import { Day } from '../day.model'

function levelsOn(pivot: Date, date: Date): number[] {
  const day = new Day(date.getTime())
  day.setLevelList(pivot.getTime())

  return day.todayLevels
}

describe('Day.setLevelList', () => {
  it('counts calendar days, not 24h periods since the pivot time', () => {
    // 28 Jul → 18 Sep is calendar day 52 of the cycle: [4, 1]
    const pivot = new Date(2026, 6, 28, 18, 0)

    expect(levelsOn(pivot, new Date(2026, 8, 18, 9, 0))).toEqual([4, 1])
    expect(levelsOn(pivot, new Date(2026, 8, 18, 23, 0))).toEqual([4, 1])
  })

  it('puts the pivot day itself on cycle day 0', () => {
    const pivot = new Date(2026, 6, 28, 18, 0)

    expect(levelsOn(pivot, new Date(2026, 6, 28, 18, 0))).toEqual([1])
    expect(levelsOn(pivot, new Date(2026, 6, 29, 7, 0))).toEqual([2, 1])
  })

  it('wraps to the start of the schedule after 64 days', () => {
    const pivot = new Date(2026, 0, 1, 12, 0)

    expect(levelsOn(pivot, new Date(2026, 2, 6, 12, 0))).toEqual([1])
  })
})
