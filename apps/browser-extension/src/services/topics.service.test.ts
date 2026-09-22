import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTopic as buildTopic } from '@/models/topic.model'
import {
  createTopic,
  ensureTopicForPage,
  getSelectedTopicId,
  getTopics,
  mergeTopics,
  renameTopic,
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

describe('ensureTopicForPage', () => {
  it('creates a page-title topic once per origin and pathname', async () => {
    const first = await ensureTopicForPage({
      title: 'Article one',
      url: 'https://example.com/posts/1?ref=nav'
    })
    const second = await ensureTopicForPage({
      title: 'Article one again',
      url: 'https://example.com/posts/1?ref=share#comments'
    })
    const other = await ensureTopicForPage({
      title: 'Other',
      url: 'https://example.com/posts/2'
    })

    expect(second.id).toBe(first.id)
    expect(first.title).toBe('Article one')
    expect(other.id).not.toBe(first.id)
    expect(await getTopics()).toHaveLength(2)
  })

  it('schedules review days from today through the rest of the week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0))

    const topic = await ensureTopicForPage({
      title: 'Page',
      url: 'https://example.com/today'
    })

    expect(topic.week).toHaveLength(7)
    expect(topic.week.slice(0, 2)).toEqual([null, null])
    expect(topic.week.slice(2).every(day => day !== null)).toBe(true)
    expect(topic.nextUpdateDate).toBe(new Date(2026, 8, 27).getTime())

    const stored = await getTopics()
    expect(stored[0]?.week).toHaveLength(7)
    expect(stored[0]?.week.slice(0, 2)).toEqual([null, null])
  })

  it('falls back to Web clips and trims to 30 characters', async () => {
    const untitled = await ensureTopicForPage({
      title: '  ',
      url: 'https://example.com/'
    })
    const long = await ensureTopicForPage({
      title: 'abcdefghijklmnopqrstuvwxyz0123456789',
      url: 'https://example.com/long'
    })

    expect(untitled.title).toBe('Web clips')
    expect(long.title).toBe('abcdefghijklmnopqrstuvwxyz0123')
    expect(long.title).toHaveLength(30)
  })
})

describe('renameTopic', () => {
  it('persists the new title', async () => {
    const topic = await createTopic('Old')
    await renameTopic(topic.id, 'New name')

    expect((await getTopics())[0]?.title).toBe('New name')
  })
})

describe('topic selection', () => {
  it('survives a reload', async () => {
    const first = buildTopic('First')
    const second = buildTopic('Second')
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
    const other = buildTopic('Other')
    const page = buildTopic('Page')

    const selected = await resolveSelectedTopicId([other, page], page.id)

    expect(selected).toBe(page.id)
    expect(await getSelectedTopicId()).toBe(page.id)
  })
})

describe('mergeTopics', () => {
  it('dedupes sync and local topics by id', async () => {
    const local = buildTopic('Local')
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
