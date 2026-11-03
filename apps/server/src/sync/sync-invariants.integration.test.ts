import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mutation } from '@spaced-rep/sync-protocol'

import { bootstrap, applyPushBatch, pullChanges } from './sync.service.js'
import { publishFanout } from './fanout.service.js'
import { wasOpApplied } from './idempotency.service.js'
import { prisma } from '../shared/lib/prisma.js'
import {
  cardFactory,
  getTestPrisma,
  topicFactory,
  userFactory
} from '../../../../testing/index.js'

vi.mock('./fanout.service.js', () => ({
  publishFanout: vi.fn(async () => undefined)
}))

const EPOCH_ISO = new Date(0).toISOString()
const BASE = 1_700_000_000_000
const DAY = 24 * 60 * 60 * 1000

function topicUpsert(input: {
  id: string
  title: string
  updatedAt: number
  deviceId: string
  opId?: string
}): Mutation {
  return {
    opId: input.opId ?? crypto.randomUUID(),
    deviceId: input.deviceId,
    table: 'topics',
    recordId: input.id,
    operation: 'upsert',
    updatedAt: input.updatedAt,
    topic: {
      id: input.id,
      title: input.title,
      pivot: 0,
      weekJson: '[]',
      nextUpdateDate: 0,
      isArchived: false,
      updatedAt: input.updatedAt,
      deletedAt: null
    }
  }
}

function cardUpsert(input: {
  id: string
  topicId: string
  updatedAt: number
  deviceId: string
  body?: string
  opId?: string
}): Mutation {
  return {
    opId: input.opId ?? crypto.randomUUID(),
    deviceId: input.deviceId,
    table: 'cards',
    recordId: input.id,
    operation: 'upsert',
    updatedAt: input.updatedAt,
    card: {
      id: input.id,
      topicId: input.topicId,
      level: 0,
      dataJson: JSON.stringify({ body: input.body ?? 'body' }),
      reviewDate: null,
      updatedAt: input.updatedAt,
      deletedAt: null
    }
  }
}

function deleteMutation(input: {
  table: 'topics' | 'cards'
  recordId: string
  updatedAt: number
  deviceId: string
}): Mutation {
  return {
    opId: crypto.randomUUID(),
    deviceId: input.deviceId,
    table: input.table,
    recordId: input.recordId,
    operation: 'delete',
    updatedAt: input.updatedAt
  }
}

async function addActiveDevice(userId: string, lastPulledAt = new Date(0)) {
  const id = crypto.randomUUID()
  await getTestPrisma().syncDevice.create({
    data: { id, userId, lastPulledAt, lastSeenAt: new Date() }
  })
  return id
}

async function pullAll(userId: string, limit: number) {
  const topicIds: string[] = []
  const cardIds: string[] = []
  let since = EPOCH_ISO
  for (let page = 0; page < 50; page++) {
    const delta = await pullChanges({ userId, since, limit })
    for (const r of delta.records) {
      if (r.topic) topicIds.push(r.topic.id)
      if (r.card) cardIds.push(r.card.id)
    }
    since = delta.watermark
    if (!delta.more) return { topicIds, cardIds }
  }
  throw new Error('pull did not terminate')
}

beforeEach(() => {
  vi.mocked(publishFanout).mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pullChanges single cursor', () => {
  it('does not skip topics when a page fills with cards', async () => {
    const user = await userFactory.create()
    const topics = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        topicFactory.create({
          userId: user.id,
          title: `topic-${i}`,
          updatedAt: new Date(BASE + i * 1000)
        })
      )
    )
    const cards = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        cardFactory.create({
          userId: user.id,
          topicId: topics[0]!.id,
          updatedAt: new Date(BASE + 100_000 + i * 1000)
        })
      )
    )

    const first = await pullChanges({
      userId: user.id,
      since: EPOCH_ISO,
      limit: 2
    })
    expect(first.more).toBe(true)
    expect(first.records).toHaveLength(2)
    expect(first.watermark).toBe(new Date(BASE + 1000).toISOString())

    const all = await pullAll(user.id, 2)
    expect(new Set(all.topicIds)).toEqual(new Set(topics.map(t => t.id)))
    expect(new Set(all.cardIds)).toEqual(new Set(cards.map(c => c.id)))
  })
})

describe('applyPushBatch fanout watermark', () => {
  it('uses the max updatedAt of fanout records only', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    await topicFactory.create({
      userId: user.id,
      title: 'unpushed-old',
      updatedAt: new Date(BASE + 500_000)
    })

    const topicId = crypto.randomUUID()
    await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        topicUpsert({
          id: topicId,
          title: 'pushed',
          updatedAt: BASE + 1000,
          deviceId
        })
      ]
    })

    const envelope = vi
      .mocked(publishFanout)
      .mock.calls.map(([arg]) => arg.envelope)
      .find(e => e.kind === 'pullDelta')
    expect(envelope?.kind === 'pullDelta' && envelope.pullDelta.watermark).toBe(
      new Date(BASE + 1000).toISOString()
    )
  })
})

describe('applyPushBatch delete LWW', () => {
  it('ignores a delete older than the row', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    await addActiveDevice(user.id)
    const topic = await topicFactory.create({
      userId: user.id,
      updatedAt: new Date(BASE + 10_000)
    })

    await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        deleteMutation({
          table: 'topics',
          recordId: topic.id,
          updatedAt: BASE + 1000,
          deviceId
        })
      ]
    })

    const { records } = await pullChanges({ userId: user.id, since: EPOCH_ISO })
    expect(records).toHaveLength(1)
    expect(records[0]?.topic?.deletedAt).toBeNull()
  })

  it('tombstones on newer delete and restores on newer upsert', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    await addActiveDevice(user.id)
    const topic = await topicFactory.create({
      userId: user.id,
      updatedAt: new Date(BASE)
    })
    const card = await cardFactory.create({
      userId: user.id,
      topicId: topic.id,
      updatedAt: new Date(BASE)
    })

    await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        deleteMutation({
          table: 'cards',
          recordId: card.id,
          updatedAt: BASE + 2000,
          deviceId
        })
      ]
    })
    let pulled = await pullChanges({ userId: user.id, since: EPOCH_ISO })
    expect(pulled.records.find(r => r.card)?.card?.deletedAt).toBe(BASE + 2000)

    await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        cardUpsert({
          id: card.id,
          topicId: topic.id,
          updatedAt: BASE + 3000,
          deviceId
        })
      ]
    })
    pulled = await pullChanges({ userId: user.id, since: EPOCH_ISO })
    const restored = pulled.records.find(r => r.card)?.card
    expect(restored?.deletedAt).toBeNull()
    expect(restored?.updatedAt).toBe(BASE + 3000)
  })
})

describe('applyPushBatch idempotency', () => {
  it('handles replays, new bodies, and opId reuse with a different body', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    const topic = await topicFactory.create({
      userId: user.id,
      updatedAt: new Date(BASE)
    })
    const cardId = crypto.randomUUID()
    const opId = crypto.randomUUID()
    const push = (mutation: Mutation) =>
      applyPushBatch({ userId: user.id, deviceId, mutations: [mutation] })
    const cardBody = async () => {
      const { records } = await pullChanges({
        userId: user.id,
        since: EPOCH_ISO
      })
      return records.find(r => r.card)?.card
    }

    const first = cardUpsert({
      id: cardId,
      topicId: topic.id,
      updatedAt: BASE + 1000,
      deviceId,
      body: 'one',
      opId
    })
    expect((await push(first)).acceptedOpIds).toEqual([opId])

    const replay = await push(first)
    expect(replay.acceptedOpIds).toEqual([opId])
    expect(replay.rejected).toHaveLength(0)
    expect(JSON.parse((await cardBody())!.dataJson)).toEqual({ body: 'one' })

    const reused = await push(
      cardUpsert({
        id: cardId,
        topicId: topic.id,
        updatedAt: BASE + 2000,
        deviceId,
        body: 'two',
        opId
      })
    )
    expect(reused.acceptedOpIds).toEqual([opId])
    const afterReuse = await cardBody()
    expect(JSON.parse(afterReuse!.dataJson)).toEqual({ body: 'one' })
    expect(afterReuse!.updatedAt).toBe(BASE + 1000)

    const newOpId = crypto.randomUUID()
    const next = await push(
      cardUpsert({
        id: cardId,
        topicId: topic.id,
        updatedAt: BASE + 3000,
        deviceId,
        body: 'two',
        opId: newOpId
      })
    )
    expect(next.acceptedOpIds).toEqual([newOpId])
    expect(JSON.parse((await cardBody())!.dataJson)).toEqual({ body: 'two' })
  })
})

describe('applyPushBatch apply + idempotency atomicity', () => {
  it('leaves neither the row nor the idempotency mark when the mark cannot commit', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    const topic = await topicFactory.create({
      userId: user.id,
      updatedAt: new Date(BASE)
    })
    const cardId = crypto.randomUUID()
    const opId = crypto.randomUUID()
    const markBoom = new Error('idempotency write failed')
    // Cover both paths: pre-fix uses prisma.syncOperation; post-fix uses tx.
    vi.spyOn(prisma.syncOperation, 'upsert').mockRejectedValueOnce(markBoom)
    const originalTransaction = prisma.$transaction.bind(prisma)
    vi.spyOn(prisma, '$transaction').mockImplementation(((
      arg: Parameters<typeof prisma.$transaction>[0],
      options?: Parameters<typeof prisma.$transaction>[1]
    ) => {
      if (typeof arg !== 'function') {
        return originalTransaction(arg, options)
      }
      return originalTransaction(async tx => {
        vi.spyOn(tx.syncOperation, 'upsert').mockRejectedValueOnce(markBoom)
        return arg(tx)
      }, options)
    }) as typeof prisma.$transaction)

    const ack = await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        cardUpsert({
          id: cardId,
          topicId: topic.id,
          updatedAt: BASE + 1000,
          deviceId,
          opId
        })
      ]
    })

    expect(ack.acceptedOpIds).toHaveLength(0)
    expect(ack.rejected.map(r => r.opId)).toEqual([opId])
    expect(await wasOpApplied(user.id, opId)).toBe(false)
    const { records } = await pullChanges({ userId: user.id, since: EPOCH_ISO })
    expect(records.some(r => r.card?.id === cardId)).toBe(false)
  })
})

describe('applyPushBatch ownership and op marking', () => {
  it('rejects a card whose topic belongs to another user', async () => {
    const user = await userFactory.create()
    const other = await userFactory.create()
    const deviceId = crypto.randomUUID()
    const foreignTopic = await topicFactory.create({ userId: other.id })
    const badOp = crypto.randomUUID()

    const ack = await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        cardUpsert({
          id: crypto.randomUUID(),
          topicId: foreignTopic.id,
          updatedAt: BASE,
          deviceId,
          opId: badOp
        })
      ]
    })

    expect(ack.acceptedOpIds).toHaveLength(0)
    expect(ack.rejected.map(r => r.opId)).toEqual([badOp])
    expect(await wasOpApplied(user.id, badOp)).toBe(false)
    const { records } = await pullChanges({ userId: user.id, since: EPOCH_ISO })
    expect(records.some(r => r.card)).toBe(false)
  })

  it('marks only accepted ops as applied', async () => {
    const user = await userFactory.create()
    const other = await userFactory.create()
    const deviceId = crypto.randomUUID()
    const topic = await topicFactory.create({ userId: user.id })
    const foreignTopic = await topicFactory.create({ userId: other.id })
    const goodOp = crypto.randomUUID()
    const badOp = crypto.randomUUID()
    const goodCardId = crypto.randomUUID()

    const ack = await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        cardUpsert({
          id: goodCardId,
          topicId: topic.id,
          updatedAt: BASE,
          deviceId,
          opId: goodOp
        }),
        cardUpsert({
          id: crypto.randomUUID(),
          topicId: foreignTopic.id,
          updatedAt: BASE,
          deviceId,
          opId: badOp
        })
      ]
    })

    expect(ack.acceptedOpIds).toEqual([goodOp])
    expect(ack.rejected.map(r => r.opId)).toEqual([badOp])
    expect(await wasOpApplied(user.id, goodOp)).toBe(true)
    expect(await wasOpApplied(user.id, badOp)).toBe(false)
    const { records } = await pullChanges({ userId: user.id, since: EPOCH_ISO })
    expect(records.filter(r => r.card).map(r => r.card?.id)).toEqual([
      goodCardId
    ])
  })
})

describe('applyPushBatch topic title conflict', () => {
  it('renames the losing topic and fans out topicConflictResolved', async () => {
    const user = await userFactory.create()
    const deviceA = crypto.randomUUID()
    const deviceB = crypto.randomUUID()
    const topicA = crypto.randomUUID()
    const topicB = crypto.randomUUID()
    const title = 'Shared'

    await applyPushBatch({
      userId: user.id,
      deviceId: deviceA,
      mutations: [
        topicUpsert({
          id: topicA,
          title,
          updatedAt: BASE,
          deviceId: deviceA
        })
      ]
    })
    vi.mocked(publishFanout).mockClear()

    const ack = await applyPushBatch({
      userId: user.id,
      deviceId: deviceB,
      mutations: [
        topicUpsert({
          id: topicB,
          title,
          updatedAt: BASE + 1000,
          deviceId: deviceB
        })
      ]
    })

    const shortId = topicA.slice(0, 4)
    const renamed = `${title} (${shortId})`
    expect(ack.conflicts).toEqual([
      expect.objectContaining({
        topicId: topicA,
        oldTitle: title,
        newTitle: renamed,
        reason: 'duplicate_title'
      })
    ])

    const conflictFanout = vi
      .mocked(publishFanout)
      .mock.calls.map(call => call[0])
      .find(arg => arg.envelope.kind === 'topicConflictResolved')
    expect(conflictFanout?.envelope).toEqual(
      expect.objectContaining({
        kind: 'topicConflictResolved',
        topicConflictResolved: expect.objectContaining({
          topicId: topicA,
          oldTitle: title,
          newTitle: renamed,
          reason: 'duplicate_title'
        })
      })
    )

    const deltaFanout = vi
      .mocked(publishFanout)
      .mock.calls.map(call => call[0])
      .find(arg => arg.envelope.kind === 'pullDelta')
    expect(deltaFanout?.excludeDeviceId).toBe(deviceB)
    const fanoutTopics =
      deltaFanout?.envelope.kind === 'pullDelta'
        ? deltaFanout.envelope.pullDelta.records
            .map(r => r.topic)
            .filter(t => t != null)
        : []
    expect(fanoutTopics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: topicA, title: renamed }),
        expect.objectContaining({ id: topicB, title })
      ])
    )

    const { records } = await pullChanges({ userId: user.id, since: EPOCH_ISO })
    const byId = new Map(
      records.flatMap(r => (r.topic ? [[r.topic.id, r.topic] as const] : []))
    )
    expect(byId.get(topicA)?.title).toBe(renamed)
    expect(byId.get(topicB)?.title).toBe(title)
  })
})

describe('tombstone purge with lagging device', () => {
  it('keeps an old tombstone until every active device has pulled past it', async () => {
    const user = await userFactory.create()
    const deviceA = crypto.randomUUID()
    const laggingDevice = await addActiveDevice(user.id)
    const prisma = getTestPrisma()
    const now = Date.now()
    const topic = await topicFactory.create({
      userId: user.id,
      updatedAt: new Date(now - 50 * DAY)
    })
    const deletedAt = now - 40 * DAY

    await applyPushBatch({
      userId: user.id,
      deviceId: deviceA,
      mutations: [
        deleteMutation({
          table: 'topics',
          recordId: topic.id,
          updatedAt: deletedAt,
          deviceId: deviceA
        })
      ]
    })

    const delta = await bootstrap({ userId: user.id, deviceId: deviceA })
    expect(delta.records[0]?.topic?.deletedAt).toBe(deletedAt)
    expect(
      await prisma.topic.findUnique({ where: { id: topic.id } })
    ).not.toBeNull()

    await bootstrap({
      userId: user.id,
      deviceId: laggingDevice,
      lastPulledAt: new Date(now).toISOString()
    })
    expect(
      await prisma.topic.findUnique({ where: { id: topic.id } })
    ).toBeNull()
  })
})
