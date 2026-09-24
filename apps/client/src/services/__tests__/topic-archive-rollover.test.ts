import { beforeEach, describe, expect, it, vi } from 'vitest'

import { STORES } from '@/lib/db'
import { createTopic, type Topic } from '@/models'

const memory = new Map<string, Map<string, unknown>>()
const enqueueSyncMock = vi.fn()
const triggerSyncMock = vi.fn()

function table(name: string): Map<string, unknown> {
  let rows = memory.get(name)
  if (!rows) {
    rows = new Map()
    memory.set(name, rows)
  }
  return rows
}

function idbRequest<T>(result: T): IDBRequest<T> {
  const request = {
    result,
    error: null as DOMException | null,
    onsuccess: null as ((this: IDBRequest<T>, ev: Event) => void) | null,
    onerror: null as ((this: IDBRequest<T>, ev: Event) => void) | null
  }
  queueMicrotask(() => {
    request.onsuccess?.call(request as IDBRequest<T>, {} as Event)
  })
  return request as IDBRequest<T>
}

function keyOf(value: { id?: string; key?: string }): string {
  return value.key ?? value.id ?? ''
}

vi.mock('@/lib/db', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/db')>()
  return {
    ...actual,
    withTransaction: vi.fn(
      async (
        storeNames: string[] | string,
        _mode: IDBTransactionMode,
        callback: (stores: Record<string, IDBObjectStore>) => Promise<unknown>
      ) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames]
        const stores: Record<string, IDBObjectStore> = {}
        for (const name of names) {
          const rows = table(name)
          stores[name] = {
            get: (key: IDBValidKey) => idbRequest(rows.get(String(key))),
            getAll: () => idbRequest([...rows.values()]),
            put: (value: { id?: string; key?: string }) => {
              const key = keyOf(value)
              rows.set(key, value)
              return idbRequest(key)
            },
            add: (value: { id?: string; key?: string }) => {
              const key = keyOf(value)
              rows.set(key, value)
              return idbRequest(key)
            },
            delete: (key: IDBValidKey) => {
              rows.delete(String(key))
              return idbRequest(undefined)
            }
          } as unknown as IDBObjectStore
        }
        return callback(stores)
      }
    )
  }
})

vi.mock('@/services/sync.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../sync.service')>()
  return {
    ...actual,
    enqueueSync: (...args: unknown[]) => enqueueSyncMock(...args),
    triggerSync: (...args: unknown[]) => triggerSyncMock(...args),
    putSyncQueueOps: vi.fn(),
    refreshSyncQueueDepth: vi.fn()
  }
})

const { getAllTopics } = await import('../topic.services')

describe('getAllTopics archive rollover', () => {
  beforeEach(() => {
    memory.clear()
    enqueueSyncMock.mockReset()
    triggerSyncMock.mockReset()
  })

  it('does not roll over or re-persist an archived topic past nextUpdateDate', async () => {
    const archived = createTopic('Old archived')
    archived.isArchived = true
    archived.nextUpdateDate = Date.now() - 86_400_000
    archived.updatedAt = 1_700_000_000_000
    const pivotBefore = archived.pivot
    const weekBefore = archived.week

    table(STORES.TOPICS).set(archived.id, archived)

    const topics = await getAllTopics()
    const result = topics.find(t => t.id === archived.id) as Topic

    expect(result.nextUpdateDate).toBe(archived.nextUpdateDate)
    expect(result.pivot).toBe(pivotBefore)
    expect(result.week).toBe(weekBefore)
    expect(result.updatedAt).toBe(1_700_000_000_000)
    expect(enqueueSyncMock).not.toHaveBeenCalled()
    expect(triggerSyncMock).not.toHaveBeenCalled()
  })
})
