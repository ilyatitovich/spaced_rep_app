import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORES } from '../../lib/db'
import type { Card } from '../../models'
import { sha256Hex } from '@spaced-rep/sync-protocol'

const pushMock = vi.fn()
const pullMock = vi.fn()
const uploadOwnedMediaMock = vi.fn()
const hydrateIncomingCardDataMock = vi.fn()

const memory = new Map<string, Map<string, unknown>>()

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
        callback: (
          stores: Record<string, IDBObjectStore>
        ) => Promise<unknown>
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

vi.mock('@/lib/card-media-stats', () => ({
  adjustCardMediaStats: vi.fn(),
  addEmbeddedMedia: vi.fn(),
  recordCardMediaDelete: vi.fn(),
  recordCardMediaUpsert: vi.fn(),
  sumEmbeddedCardMedia: vi.fn(() => ({ bytes: 0, images: 0, audio: 0 })),
  subEmbeddedMedia: vi.fn()
}))

vi.mock('@/providers', () => ({
  isBackendConfigured: () => true,
  sync: {
    push: (...args: unknown[]) => pushMock(...args),
    pull: (...args: unknown[]) => pullMock(...args),
    bootstrap: vi.fn(),
    connectRealtime: undefined
  }
}))

vi.mock('@/lib/sync-media', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/sync-media')>()
  return {
    ...actual,
    uploadOwnedMedia: (...args: unknown[]) => uploadOwnedMediaMock(...args),
    hydrateIncomingCardData: (...args: unknown[]) =>
      hydrateIncomingCardDataMock(...args)
  }
})

vi.mock('../sync-http.client', () => ({
  httpSyncMediaApi: { planUploads: vi.fn(), planDownloads: vi.fn() }
}))

const { applyPullDelta, pushChanges, enqueueSync } = await import(
  '../sync.service'
)
const { withTransaction } = await import('../../lib/db')

function bytes(values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length)
  new Uint8Array(buffer).set(values)
  return buffer
}

function seedMeta(key: string, value: string): void {
  table(STORES.SYNC_META).set(key, { key, value })
}

function seedCard(card: Card): void {
  table(STORES.CARDS).set(card.id, card)
}

beforeEach(() => {
  memory.clear()
  pushMock.mockReset()
  pullMock.mockReset()
  uploadOwnedMediaMock.mockReset()
  hydrateIncomingCardDataMock.mockReset()
  vi.mocked(withTransaction).mockClear()
  seedMeta('deviceId', 'device-1')
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('applyPullDelta (shared pull/bootstrap/reconcile/WS path)', () => {
  it('does not persist cards or advance watermark when hydrate fails', async () => {
    hydrateIncomingCardDataMock.mockRejectedValue(
      new Error('Media integrity check failed')
    )

    await expect(
      applyPullDelta({
        watermark: '2024-06-01T00:00:00.000Z',
        more: false,
        records: [
          {
            card: {
              id: 'card-1',
              topicId: 'topic-1',
              level: 0,
              dataJson: JSON.stringify({
                front: { blocks: [] },
                back: { blocks: [] }
              }),
              reviewDate: null,
              updatedAt: 1,
              deletedAt: null
            }
          }
        ]
      })
    ).rejects.toThrow(/integrity/i)

    expect(table(STORES.CARDS).size).toBe(0)
    expect(table(STORES.SYNC_META).get('lastPulledAt')).toBeUndefined()
  })

  it('hydrates then persists and advances watermark only after success', async () => {
    const buffer = bytes([1, 2, 3])
    hydrateIncomingCardDataMock.mockResolvedValue(
      new Map([
        [
          'card-1',
          {
            front: {
              side: 'front',
              blocks: [
                { type: 'image', content: { buffer, type: 'image/png' } }
              ]
            },
            back: { side: 'back', blocks: [] }
          }
        ]
      ])
    )

    await applyPullDelta({
      watermark: '2024-06-01T00:00:00.000Z',
      more: false,
      records: [
        {
          card: {
            id: 'card-1',
            topicId: 'topic-1',
            level: 0,
            dataJson: JSON.stringify({
              front: { blocks: [] },
              back: { blocks: [] }
            }),
            reviewDate: null,
            updatedAt: 1,
            deletedAt: null
          }
        }
      ]
    })

    expect(hydrateIncomingCardDataMock).toHaveBeenCalledOnce()
    const stored = table(STORES.CARDS).get('card-1') as Card
    expect(stored.id).toBe('card-1')
    expect(
      (stored.data as { front: { blocks: Array<{ content: { buffer: ArrayBuffer } }> } })
        .front.blocks[0]!.content.buffer
    ).toBe(buffer)
    expect(table(STORES.SYNC_META).get('lastPulledAt')).toEqual({
      key: 'lastPulledAt',
      value: '2024-06-01T00:00:00.000Z'
    })
  })
})

describe('pushChanges media ordering', () => {
  it('uploads owned media before pushBatch and keeps queue on upload failure', async () => {
    const buffer = bytes([9, 8, 7, 6])
    const hash = await sha256Hex(buffer)
    seedCard({
      id: 'card-1',
      topicId: 'topic-1',
      level: 0,
      data: {
        front: {
          side: 'front',
          blocks: [{ type: 'image', content: { buffer, type: 'image/png' } }]
        },
        back: { side: 'back', blocks: [] }
      },
      updatedAt: 1_000
    })
    await enqueueSync(STORES.CARDS, 'card-1', 'upsert')

    uploadOwnedMediaMock.mockRejectedValue(new Error('upload failed'))

    await expect(pushChanges('device-1')).rejects.toThrow(/upload failed/)

    expect(uploadOwnedMediaMock).toHaveBeenCalledOnce()
    expect(uploadOwnedMediaMock.mock.calls[0]![0].has(hash)).toBe(true)
    expect(pushMock).not.toHaveBeenCalled()
    expect(table(STORES.SYNC_QUEUE).size).toBe(1)
  })

  it('calls pushBatch only after uploadOwnedMedia resolves', async () => {
    const buffer = bytes([4, 5])
    seedCard({
      id: 'card-2',
      topicId: 'topic-1',
      level: 0,
      data: {
        front: {
          side: 'front',
          blocks: [{ type: 'image', content: { buffer, type: 'image/png' } }]
        },
        back: { side: 'back', blocks: [] }
      },
      updatedAt: 2_000
    })
    await enqueueSync(STORES.CARDS, 'card-2', 'upsert')

    const order: string[] = []
    uploadOwnedMediaMock.mockImplementation(async () => {
      order.push('upload')
    })
    pushMock.mockImplementation(
      async (input: { mutations: { opId: string }[] }) => {
        order.push('push')
        return {
          acceptedOpIds: input.mutations.map(m => m.opId),
          rejected: [],
          conflicts: []
        }
      }
    )

    await pushChanges('device-1')

    expect(order).toEqual(['upload', 'push'])
    expect(table(STORES.SYNC_QUEUE).size).toBe(0)
  })
})
