import { saveTopic } from '@/lib/db'
import { Topic } from '@/models'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../lib/db', () => ({
  saveTopic: vi.fn()
}))

describe('Topic Class', () => {
  let topic: Topic

  beforeEach(() => {
    topic = new Topic('Test Topic')
  })

  it('should create a Topic instance with default values', () => {
    expect(topic).toBeInstanceOf(Topic)
    expect(topic.title).toBe('Test Topic')
    expect(topic.id).toBeDefined()
    expect(topic.pivotDate).toBeLessThanOrEqual(Date.now())
    expect(topic.week).toHaveLength(7)
    expect(topic.draft).toEqual([])
    expect(topic.levels).toBeDefined()
    expect(topic.nextUpdateDate).toBeGreaterThan(Date.now())
  })

  it('should correctly set the week with some null values before the pivot day', () => {
    const startDay = new Date(topic.pivotDate).getDay()
    expect(topic.week.slice(0, startDay)).toEqual(Array(startDay).fill(null))
  })

  it('should calculate the next Sunday timestamp correctly', () => {
    const nextSunday = topic.nextUpdateDate
    const expectedSunday = new Date(nextSunday).getDay()
    expect(expectedSunday).toBe(0)
  })

  it('should update the week and nextUpdateDate when updateWeek() is called', () => {
    topic.nextUpdateDate = Date.now() - 7 * 86400000 // Set to last week
    const prevUpdateDate = topic.nextUpdateDate
    topic.updateWeek()

    expect(topic.week).toHaveLength(7)
    expect(topic.nextUpdateDate).toBeGreaterThan(prevUpdateDate)
    expect(saveTopic).toHaveBeenCalledWith(topic)
  })
})
