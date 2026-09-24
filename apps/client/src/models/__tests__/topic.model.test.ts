import { describe, expect, it, vi } from 'vitest'

import { createTopic, reactivateTopic } from '../topic.model'

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

    vi.useRealTimers()
  })
})
