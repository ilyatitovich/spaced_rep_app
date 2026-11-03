/**
 * In-memory stand-in for IndexedDB used by service tests.
 *
 * `vi.mock` factories are hoisted above imports, so wire it up lazily:
 *
 *   vi.mock('@/lib/db', async () => (await import('./helpers/fake-idb')).fakeDbModule())
 */
import { vi } from 'vitest'

export const memory = new Map<string, Map<string, unknown>>()

export function table(name: string): Map<string, unknown> {
  let rows = memory.get(name)
  if (!rows) {
    rows = new Map()
    memory.set(name, rows)
  }
  return rows
}

export function idbRequest<T>(result: T): IDBRequest<T> {
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

export function keyOf(value: { id?: string; key?: string }): string {
  return value.key ?? value.id ?? ''
}

function fakeObjectStore(rows: Map<string, unknown>): IDBObjectStore {
  const put = (value: { id?: string; key?: string }) => {
    const key = keyOf(value)
    rows.set(key, value)
    return idbRequest(key)
  }
  return {
    get: (key: IDBValidKey) => idbRequest(rows.get(String(key))),
    getAll: () => idbRequest([...rows.values()]),
    put,
    add: put,
    delete: (key: IDBValidKey) => {
      rows.delete(String(key))
      return idbRequest(undefined)
    },
    clear: () => {
      rows.clear()
      return idbRequest(undefined)
    }
  } as unknown as IDBObjectStore
}

/** Drop-in for `withTransaction` from `@/lib/db`, backed by `memory`. */
export async function fakeWithTransaction(
  storeNames: string[] | string,
  _mode: IDBTransactionMode,
  callback: (stores: Record<string, IDBObjectStore>) => Promise<unknown>
): Promise<unknown> {
  const names = Array.isArray(storeNames) ? storeNames : [storeNames]
  const stores: Record<string, IDBObjectStore> = {}
  for (const name of names) stores[name] = fakeObjectStore(table(name))
  return callback(stores)
}

export async function fakeDbModule() {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return { ...actual, withTransaction: vi.fn(fakeWithTransaction) }
}
