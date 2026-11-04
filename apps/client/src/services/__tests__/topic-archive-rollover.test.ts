import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { STORES } from '@/lib/db'
import { createTopic, setStartWeek, type Topic } from '@/models'
import { memory, table } from './helpers/fake-idb'

const putSyncQueueOpsMock = vi.fn()
const triggerSyncMock = vi.fn()

vi.mock('@/lib/db', async () =>
  (await import('./helpers/fake-idb')).fakeDbModule()
)

vi.mock('@/services/sync.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../sync.service')>()
  return {
    ...actual,
    putSyncQueueOps: (...args: unknown[]) => putSyncQueueOpsMock(...args),
    triggerSync: (...args: unknown[]) => triggerSyncMock(...args),
    refreshSyncQueueDepth: vi.fn()
  }
})

const { getAllTopics } = await import('../topic.services')
const { __resetStudyMemoryForTests, hydrateStudyMemory } =
  await import('../study-memory')

describe('getAllTopics archive rollover', () => {
  beforeEach(() => {
    memory.clear()
    __resetStudyMemoryForTests()
    putSyncQueueOpsMock.mockReset()
    triggerSyncMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not roll over or re-persist an archived topic past nextUpdateDate', async () => {
    const archived = createTopic('Old archived')
    archived.isArchived = true
    archived.nextUpdateDate = Date.now() - 86_400_000
    archived.updatedAt = 1_700_000_000_000
    const pivotBefore = archived.pivot
    const weekBefore = archived.week

    table(STORES.TOPICS).set(archived.id, archived)
    await hydrateStudyMemory()

    const topics = await getAllTopics()
    const result = topics.find(t => t.id === archived.id) as Topic

    expect(result.nextUpdateDate).toBe(archived.nextUpdateDate)
    expect(result.pivot).toBe(pivotBefore)
    expect(result.week).toEqual(weekBefore)
    expect(result.updatedAt).toBe(1_700_000_000_000)
    expect(putSyncQueueOpsMock).not.toHaveBeenCalled()
    expect(triggerSyncMock).not.toHaveBeenCalled()
  })

  it('rolls an active topic past nextUpdateDate: rebuilds week, clears isDone, keeps pivot, enqueues one upsert', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 8, 10, 0, 0)) // Sun

    const active = createTopic('Active study')
    const pivotBefore = new Date(2026, 10, 4, 15, 30, 0).getTime() // Wed
    active.pivot = pivotBefore
    active.week = setStartWeek(pivotBefore)
    active.week[3]!.isDone = true
    active.nextUpdateDate = new Date(2026, 10, 8, 0, 0, 0, 0).getTime()
    active.updatedAt = 1_700_000_000_000

    table(STORES.TOPICS).set(active.id, active)
    await hydrateStudyMemory()

    const topics = await getAllTopics()
    const result = topics.find(t => t.id === active.id) as Topic

    expect(result.pivot).toBe(pivotBefore)
    expect(result.week).toHaveLength(7)
    expect(result.week.every(day => day !== null)).toBe(true)
    expect(result.week.every(day => day!.isDone === false)).toBe(true)
    expect(result.nextUpdateDate).toBe(
      new Date(2026, 10, 15, 0, 0, 0, 0).getTime()
    )
    expect(putSyncQueueOpsMock).toHaveBeenCalledTimes(1)
    expect(putSyncQueueOpsMock).toHaveBeenCalledWith(expect.anything(), [
      { table: STORES.TOPICS, recordId: active.id, operation: 'upsert' }
    ])
    expect(triggerSyncMock).toHaveBeenCalled()
  })
})
