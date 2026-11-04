import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mutation } from '@spaced-rep/sync-protocol'
import { setMediaStorageForTests } from './media.service.js'
import type { R2Storage } from '../shared/lib/r2-storage.js'

const ID = '11111111-1111-4111-8111-111111111111'
const TOPIC_ID = '22222222-2222-4222-8222-222222222222'
const OP_BAD = '33333333-3333-4333-8333-333333333333'
const OP_GOOD = '44444444-4444-4444-8444-444444444444'

const tx = {
  $queryRaw: vi.fn(),
  card: { findUnique: vi.fn(), upsert: vi.fn() },
  topic: { findUnique: vi.fn(), upsert: vi.fn() }
}

vi.mock('../shared/lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    card: { findMany: vi.fn() },
    topic: { findMany: vi.fn(), findUnique: vi.fn() }
  }
}))
vi.mock('./seq.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  lockUserSeq: vi.fn(async () => ({ next: async () => 1n }))
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
  cacheOpApplied: vi.fn(),
  pruneAppliedOps: vi.fn(),
  wasOpApplied: vi.fn().mockResolvedValue(false)
}))

const { applyPushBatch } = await import('./sync.service.js')

function noMediaStorage(): R2Storage {
  return {
    bucket: 'test',
    objectKey: (userId, hash) => `${userId}/${hash}`,
    headObject: vi.fn().mockResolvedValue(null),
    putObject: vi.fn(),
    presignPut: vi.fn(),
    presignGet: vi.fn(),
    deletePrefix: vi.fn()
  }
}

function card(opId: string, dataJson = '{}'): Mutation {
  return {
    opId,
    deviceId: ID,
    table: 'cards',
    recordId: ID,
    operation: 'upsert',
    updatedAt: 1,
    card: { id: ID, topicId: TOPIC_ID, level: 0, dataJson, updatedAt: 1 }
  }
}

const push = (mutations: Mutation[]) =>
  applyPushBatch({ userId: 'user-1', deviceId: ID, mutations })

describe('applyPushBatch rejections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMediaStorageForTests(noMediaStorage())
    tx.card.findUnique.mockResolvedValue(null)
  })

  it('rejects a malformed op as non-retryable VALIDATION_ERROR before touching the DB', async () => {
    const ack = await push([card(OP_BAD, '{nope')])

    expect(ack.acceptedOpIds).toEqual([])
    expect(ack.rejected).toEqual([
      expect.objectContaining({
        opId: OP_BAD,
        code: 'VALIDATION_ERROR',
        retryable: false
      })
    ])
    expect(tx.card.upsert).not.toHaveBeenCalled()
  })

  it('does not let one malformed card fail its batch neighbours', async () => {
    tx.topic.findUnique.mockResolvedValue({ userId: 'user-1' })

    const ack = await push([card(OP_BAD, '{nope'), card(OP_GOOD)])

    expect(ack.acceptedOpIds).toEqual([OP_GOOD])
    expect(ack.rejected.map(r => r.opId)).toEqual([OP_BAD])
    expect(tx.card.upsert).toHaveBeenCalledOnce()
  })

  it("rejects a card under another user's topic permanently", async () => {
    tx.topic.findUnique.mockResolvedValue({ userId: 'someone-else' })

    const ack = await push([card(OP_GOOD)])

    expect(ack.rejected).toEqual([
      expect.objectContaining({
        opId: OP_GOOD,
        code: 'FORBIDDEN',
        retryable: false
      })
    ])
  })

  it('keeps a card whose topic has not synced yet retryable', async () => {
    tx.topic.findUnique.mockResolvedValue(null)

    const ack = await push([card(OP_GOOD)])

    expect(ack.rejected).toEqual([
      expect.objectContaining({
        opId: OP_GOOD,
        code: 'TOPIC_NOT_SYNCED',
        retryable: true
      })
    ])
  })

  it('keeps unexpected failures retryable', async () => {
    tx.topic.findUnique.mockRejectedValue(new Error('connection reset'))

    const ack = await push([card(OP_GOOD)])

    expect(ack.rejected).toEqual([
      expect.objectContaining({
        opId: OP_GOOD,
        code: 'APPLY_FAILED',
        retryable: true
      })
    ])
  })
})
