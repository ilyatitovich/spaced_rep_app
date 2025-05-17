import { describe, it, expect } from 'vitest'

import { DayOfWeek } from '@/models'

describe('DayOfWeek class', () => {
  const pivot = 1672531200000 // Jan 1, 2023
  const date = 1672531200000 // Jan 1, 2023

  it('should initialize with correct date and isCompleted status', () => {
    const dayOfWeek = new DayOfWeek(date)

    expect(dayOfWeek.date).toBe(date)
    expect(dayOfWeek.isCompleted).toBe(false)
  })

  it('should calculate review levels correctly for day 1 (when topic was created)', () => {
    const dayOfWeek = new DayOfWeek(date)

    dayOfWeek.calculateReviewLevels(pivot)

    expect(dayOfWeek.reviewLevels).toEqual([0])
  })

  it('should calculate review levels correctly for day 2 (next day)', () => {
    const dayOfWeek = new DayOfWeek(pivot + 1 * 86400000)

    dayOfWeek.calculateReviewLevels(pivot)

    expect(dayOfWeek.reviewLevels).toEqual([0, 1])
  })

  it('should calculate review levels correctly for day 4', () => {
    const dayOfWeek = new DayOfWeek(pivot + 4 * 86400000)

    dayOfWeek.calculateReviewLevels(pivot)

    expect(dayOfWeek.reviewLevels).toEqual([0, 2])
  })

  it('should calculate review levels correctly for day 8', () => {
    const dayOfWeek = new DayOfWeek(pivot + 8 * 86400000)

    dayOfWeek.calculateReviewLevels(pivot)

    expect(dayOfWeek.reviewLevels).toEqual([0, 3])
  })

  it('should calculate review levels correctly for day 16', () => {
    const dayOfWeek = new DayOfWeek(pivot + 16 * 86400000)

    dayOfWeek.calculateReviewLevels(pivot)

    expect(dayOfWeek.reviewLevels).toEqual([0, 4])
  })

  it('should calculate review levels correctly for day 64', () => {
    const dayOfWeek = new DayOfWeek(pivot + 64 * 86400000)

    dayOfWeek.calculateReviewLevels(pivot)

    expect(dayOfWeek.reviewLevels).toEqual([0, 2, 6])
  })

  it('should calculate review levels correctly for day 256', () => {
    const dayOfWeek = new DayOfWeek(pivot + 256 * 86400000)

    dayOfWeek.calculateReviewLevels(pivot)

    expect(dayOfWeek.reviewLevels).toEqual([0])
  })
})
