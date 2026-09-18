import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { R2Storage } from '../shared/lib/r2-storage.js'
import { setMediaStorageForTests } from './media.service.js'

const HASH = 'c'.repeat(64)

vi.mock('../shared/lib/prisma.js', () => ({
  prisma: {
    card: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn()
    },
    topic: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

vi.mock('./conflict.service.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  countOtherActiveDevices: vi.fn().mockResolvedValue(1),
  purgeSyncedTombstones: vi.fn(),
  resolveTopicTitleConflict: vi.fn()
}))

vi.mock('./fanout.service.js', () => ({ publishFanout: vi.fn() }))
vi.mock('./idempotency.service.js', () => ({
  markOpApplied: vi.fn(),
  wasOpApplied: vi.fn().mockResolvedValue(false)
}))

const { applyPushBatch } = await import('./sync.service.js')
const { prisma } = await import('../shared/lib/prisma.js')

function mockStorage(): R2Storage {
  return {
    bucket: 'test',
    objectKey: (userId, hash) => `${userId}/${hash}`,
    headObject: vi.fn().mockResolvedValue(null),
    putObject: vi.fn(),
    presignPut: vi.fn(),
    presignGet: vi.fn()
  }
}

describe('applyPushBatch media validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMediaStorageForTests(mockStorage())
    vi.mocked(prisma.topic.findMany).mockResolvedValue([])
    vi.mocked(prisma.card.findMany).mockResolvedValue([])
  })

  it('rejects card upserts with MEDIA_NOT_FOUND before writing', async () => {
    const ack = await applyPushBatch({
      userId: 'user-1',
      deviceId: 'device-1',
      mutations: [
        {
          opId: 'op-1',
          deviceId: 'device-1',
          table: 'cards',
          recordId: 'card-1',
          operation: 'upsert',
          updatedAt: Date.now(),
          card: {
            id: 'card-1',
            topicId: 'topic-1',
            level: 0,
            dataJson: JSON.stringify({
              front: {
                blocks: [
                  {
                    type: 'image',
                    content: {
                      hash: HASH,
                      type: 'image/png',
                      byteLength: 8
                    }
                  }
                ]
              },
              back: { blocks: [] }
            }),
            updatedAt: Date.now()
          }
        }
      ]
    })

    expect(ack.acceptedOpIds).toEqual([])
    expect(ack.rejected).toEqual([
      expect.objectContaining({
        opId: 'op-1',
        code: 'MEDIA_NOT_FOUND',
        retryable: true
      })
    ])
    expect(prisma.card.upsert).not.toHaveBeenCalled()
  })

  it('rejects card upserts with MEDIA_INTEGRITY when HeadObject metadata mismatches', async () => {
    const storage = mockStorage()
    storage.headObject = vi.fn().mockResolvedValue({
      contentLength: 1,
      contentType: 'image/png',
      checksumSHA256: 'wrong'
    })
    setMediaStorageForTests(storage)

    const ack = await applyPushBatch({
      userId: 'user-1',
      deviceId: 'device-1',
      mutations: [
        {
          opId: 'op-2',
          deviceId: 'device-1',
          table: 'cards',
          recordId: 'card-2',
          operation: 'upsert',
          updatedAt: Date.now(),
          card: {
            id: 'card-2',
            topicId: 'topic-1',
            level: 0,
            dataJson: JSON.stringify({
              front: {
                blocks: [
                  {
                    type: 'image',
                    content: {
                      hash: HASH,
                      type: 'image/png',
                      byteLength: 8
                    }
                  }
                ]
              },
              back: { blocks: [] }
            }),
            updatedAt: Date.now()
          }
        }
      ]
    })

    expect(ack.acceptedOpIds).toEqual([])
    expect(ack.rejected).toEqual([
      expect.objectContaining({
        opId: 'op-2',
        code: 'MEDIA_INTEGRITY',
        retryable: true
      })
    ])
    expect(prisma.card.upsert).not.toHaveBeenCalled()
  })
})
