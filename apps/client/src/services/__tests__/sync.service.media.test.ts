import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORES } from '@/lib/db'
import type { Card } from '@/models'
import { sha256Hex } from '@spaced-rep/sync-protocol'
import { memory, table } from './helpers/fake-idb'
import { seedMeta } from './helpers/sync-fixtures'

const pushMock = vi.fn()
const pullMock = vi.fn()
const uploadOwnedMediaMock = vi.fn()
const hydrateIncomingCardDataMock = vi.fn()

vi.mock('@/lib/db', async () =>
  (await import('./helpers/fake-idb')).fakeDbModule()
)

vi.mock('@/lib/card-media-stats', async () =>
  (await import('./helpers/sync-mocks')).cardMediaStatsModule()
)

vi.mock('@/providers', async () =>
  (await import('./helpers/sync-mocks')).providersModule({
    push: pushMock,
    pull: pullMock,
    bootstrap: vi.fn()
  })
)

vi.mock('@/lib/sync-media', async () =>
  (await import('./helpers/sync-mocks')).syncMediaModule({
    uploadOwnedMedia: uploadOwnedMediaMock,
    hydrateIncomingCardData: hydrateIncomingCardDataMock
  })
)

vi.mock('../sync-http.client', async () =>
  (await import('./helpers/sync-mocks')).syncHttpClientModule()
)

const { applyPullDelta, pushChanges, enqueueSync } =
  await import('../sync.service')
const { withTransaction } = await import('../../lib/db')
const { __resetStudyMemoryForTests, hydrateStudyMemory } =
  await import('../study-memory')

function bytes(values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length)
  new Uint8Array(buffer).set(values)
  return buffer
}

async function seedCard(card: Card): Promise<void> {
  table(STORES.CARDS).set(card.id, card)
  await hydrateStudyMemory()
}

beforeEach(() => {
  memory.clear()
  __resetStudyMemoryForTests()
  pushMock.mockReset()
  pullMock.mockReset()
  uploadOwnedMediaMock.mockReset()
  hydrateIncomingCardDataMock.mockReset()
  vi.mocked(withTransaction).mockClear()
  seedMeta('deviceId', 'device-1')
})

afterEach(() => {
  __resetStudyMemoryForTests()
  vi.clearAllMocks()
})

describe('applyPullDelta (shared pull/bootstrap/reconcile/WS path)', () => {
  it('does not persist cards or advance watermark when hydrate fails', async () => {
    hydrateIncomingCardDataMock.mockRejectedValue(
      new Error('Media integrity check failed')
    )

    await expect(
      applyPullDelta({
        watermark: '20240601',
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
      watermark: '20240601',
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
      (
        stored.data as {
          front: { blocks: Array<{ content: { buffer: ArrayBuffer } }> }
        }
      ).front.blocks[0]!.content.buffer
    ).toBe(buffer)
    expect(table(STORES.SYNC_META).get('lastPulledAt')).toEqual({
      key: 'lastPulledAt',
      value: '20240601'
    })
  })
})

describe('pushChanges media ordering', () => {
  it('uploads owned media before pushBatch and keeps queue on upload failure', async () => {
    const buffer = bytes([9, 8, 7, 6])
    const hash = await sha256Hex(buffer)
    await seedCard({
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
    await seedCard({
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
