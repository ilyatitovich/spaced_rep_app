import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const IDLE_MS = 30_000

type FakeDb = IDBDatabase & {
  close: ReturnType<typeof vi.fn>
  transaction: ReturnType<typeof vi.fn>
}

function makeFakeDb(): FakeDb {
  const db = {
    name: 'spacedRepApp',
    version: 6,
    objectStoreNames: {
      contains: () => true,
      length: 1,
      item: () => 'topics',
      [Symbol.iterator]: function* () {
        yield 'topics'
      }
    } as unknown as DOMStringList,
    onversionchange: null as
      ((this: IDBDatabase, ev: IDBVersionChangeEvent) => void) | null,
    onclose: null,
    onabort: null,
    onerror: null,
    close: vi.fn(),
    transaction: vi.fn(),
    createObjectStore: vi.fn(),
    deleteObjectStore: vi.fn()
  }

  db.transaction.mockImplementation(() => {
    const store = {
      put: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      count: vi.fn(),
      index: vi.fn(),
      createIndex: vi.fn(),
      name: 'topics',
      keyPath: 'id',
      indexNames: { contains: () => false } as unknown as DOMStringList,
      transaction: null as unknown as IDBTransaction
    }
    let aborted = false
    const tx = {
      objectStore: () => store,
      abort: vi.fn(() => {
        aborted = true
        Promise.resolve().then(() => {
          tx.onabort?.call(tx as unknown as IDBTransaction, {} as Event)
        })
      }),
      error: null as DOMException | null,
      oncomplete: null as ((this: IDBTransaction, ev: Event) => void) | null,
      onabort: null as ((this: IDBTransaction, ev: Event) => void) | null,
      onerror: null as ((this: IDBTransaction, ev: Event) => void) | null
    }
    store.transaction = tx as unknown as IDBTransaction
    Promise.resolve().then(() => {
      if (!aborted) {
        tx.oncomplete?.call(tx as unknown as IDBTransaction, {} as Event)
      }
    })
    return tx
  })

  return db as unknown as FakeDb
}

describe('db connection lifecycle', () => {
  let openMock: ReturnType<typeof vi.fn>
  let fakeDb: FakeDb

  beforeEach(async () => {
    vi.resetModules()
    vi.useFakeTimers()
    fakeDb = makeFakeDb()
    openMock = vi.fn(() => {
      const request = {
        result: fakeDb,
        error: null as DOMException | null,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null,
        onerror: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null,
        onupgradeneeded: null as
          ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => void) | null,
        onblocked: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null
      }
      queueMicrotask(() => {
        request.onsuccess?.call(
          request as unknown as IDBOpenDBRequest,
          {} as Event
        )
      })
      return request
    })
    vi.stubGlobal('indexedDB', { open: openMock })
  })

  afterEach(async () => {
    const { closeDatabase } = await import('../db')
    closeDatabase()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reuses one IndexedDB connection across withTransaction calls', async () => {
    const { withTransaction, STORES } = await import('../db')

    await withTransaction(STORES.TOPICS, 'readonly', async () => 'a')
    await withTransaction(STORES.TOPICS, 'readonly', async () => 'b')

    expect(openMock).toHaveBeenCalledTimes(1)
    expect(fakeDb.transaction).toHaveBeenCalledTimes(2)
  })

  it('closes and drops the cache on versionchange', async () => {
    const { withTransaction, STORES } = await import('../db')

    await withTransaction(STORES.TOPICS, 'readonly', async () => undefined)
    expect(fakeDb.onversionchange).toBeTypeOf('function')

    fakeDb.onversionchange?.call(fakeDb, {} as IDBVersionChangeEvent)
    expect(fakeDb.close).toHaveBeenCalled()

    await withTransaction(STORES.TOPICS, 'readonly', async () => undefined)
    expect(openMock).toHaveBeenCalledTimes(2)
  })

  it('closes the connection after idle timeout', async () => {
    const { withTransaction, STORES } = await import('../db')

    await withTransaction(STORES.TOPICS, 'readonly', async () => undefined)
    expect(fakeDb.close).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(IDLE_MS)
    expect(fakeDb.close).toHaveBeenCalledTimes(1)

    await withTransaction(STORES.TOPICS, 'readonly', async () => undefined)
    expect(openMock).toHaveBeenCalledTimes(2)
  })

  it('rejects when the open request is blocked', async () => {
    openMock.mockImplementationOnce(() => {
      const request = {
        result: null,
        error: null as DOMException | null,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null,
        onerror: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null,
        onupgradeneeded: null as
          ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => void) | null,
        onblocked: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null
      }
      queueMicrotask(() => {
        request.onblocked?.call(
          request as unknown as IDBOpenDBRequest,
          {} as Event
        )
      })
      return request
    })

    const { withTransaction, STORES } = await import('../db')

    await expect(
      withTransaction(STORES.TOPICS, 'readonly', async () => undefined)
    ).rejects.toThrow(/blocked/i)
  })

  it('maps QuotaExceededError to a user-facing message', async () => {
    const { withTransaction, STORES, QUOTA_EXCEEDED_MESSAGE } =
      await import('../db')

    await expect(
      withTransaction(STORES.TOPICS, 'readwrite', async () => {
        throw new DOMException('quota', 'QuotaExceededError')
      })
    ).rejects.toThrow(QUOTA_EXCEEDED_MESSAGE)
  })
})
