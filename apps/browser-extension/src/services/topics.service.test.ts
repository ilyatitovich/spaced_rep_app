import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTopics, ensureLocalTopic } from './topics.service'

const values: Record<string, unknown> = {}

beforeEach(() => {
  for (const key of Object.keys(values)) delete values[key]
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: values[key] }),
        set: async (next: Record<string, unknown>) =>
          Object.assign(values, next),
        remove: async (key: string | string[]) => {
          for (const k of Array.isArray(key) ? key : [key]) delete values[k]
        }
      }
    }
  } as unknown as typeof chrome
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ensureLocalTopic', () => {
  it('schedules review days from today through the rest of the week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0))

    const topic = await ensureLocalTopic()

    expect(topic.week).toHaveLength(7)
    expect(topic.week.slice(0, 2)).toEqual([null, null])
    expect(topic.week.slice(2).every(day => day !== null)).toBe(true)
    expect(topic.nextUpdateDate).toBe(new Date(2026, 8, 27).getTime())

    const stored = await getTopics()
    expect(stored[0]?.week).toHaveLength(7)
    expect(stored[0]?.week.slice(0, 2)).toEqual([null, null])
  })
})
