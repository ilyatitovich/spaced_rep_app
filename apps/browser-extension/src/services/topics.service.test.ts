import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTopic } from '@/models/topic.model'
import {
  ensureLocalTopic,
  getSelectedTopicId,
  getTopics,
  mergeTopics,
  resolveSelectedTopicId,
  setSelectedTopicId,
  setTopics
} from './topics.service'

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

  it('reuses an existing topic by id instead of matching the default title', async () => {
    const existing = createTopic('My deck')
    await setTopics([existing])

    const topic = await ensureLocalTopic()

    expect(topic.id).toBe(existing.id)
    expect(await getTopics()).toHaveLength(1)
  })
})

describe('topic selection', () => {
  it('survives a reload', async () => {
    const first = createTopic('First')
    const second = createTopic('Second')
    await setTopics([first, second])
    await setSelectedTopicId(second.id)

    const reloaded = await getTopics()
    const selected = await resolveSelectedTopicId(
      [...reloaded].reverse(),
      first.id
    )

    expect(selected).toBe(second.id)
    expect(await getSelectedTopicId()).toBe(second.id)
  })

  it('falls back to the page topic when nothing is stored', async () => {
    const other = createTopic('Other')
    const page = createTopic('Page')

    const selected = await resolveSelectedTopicId([other, page], page.id)

    expect(selected).toBe(page.id)
    expect(await getSelectedTopicId()).toBe(page.id)
  })
})

describe('mergeTopics', () => {
  it('dedupes sync and local topics by id', async () => {
    const local = createTopic('Local')
    const fromSync = {
      ...local,
      title: 'From sync',
      updatedAt: local.updatedAt + 1
    }
    await setTopics([local, fromSync])

    const stored = await getTopics()
    expect(stored).toHaveLength(1)
    expect(stored[0]?.id).toBe(local.id)
    expect(stored[0]?.title).toBe('From sync')
    expect(mergeTopics([local], [fromSync])).toEqual([fromSync])
  })
})
