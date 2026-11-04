import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_CURSOR, type Mutation } from '@spaced-rep/sync-protocol'

import { readFileSync } from 'node:fs'
import {
  bootstrap,
  applyPushBatch,
  finishSyncCycle,
  pullChanges
} from './sync.service.js'
import { MAX_FUTURE_SKEW_MS } from './seq.js'
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

async function addActiveDevice(userId: string, lastPulledSeq = 0n) {
  const id = crypto.randomUUID()
  await getTestPrisma().syncDevice.create({
    data: { id, userId, lastPulledSeq, lastSeenAt: new Date() }
  })
  return id
}

async function pullAll(userId: string, limit: number) {
  const topicIds: string[] = []
  const cardIds: string[] = []
  let since = INITIAL_CURSOR
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
      since: INITIAL_CURSOR,
      limit: 2
    })
    expect(first.more).toBe(true)
    expect(first.records).toHaveLength(2)
    // Topics were seeded first, so they hold server sequences 1 and 2.
    expect(first.watermark).toBe('2')

    const all = await pullAll(user.id, 2)
    expect(new Set(all.topicIds)).toEqual(new Set(topics.map(t => t.id)))
    expect(new Set(all.cardIds)).toEqual(new Set(cards.map(c => c.id)))
  })

  it('does not strand rows that share updatedAt across a page boundary', async () => {
    const user = await userFactory.create()
    const tied = new Date(BASE + 5000)
    const topics = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        topicFactory.create({
          userId: user.id,
          title: `tied-topic-${i}`,
          updatedAt: tied
        })
      )
    )
    const cards = await Promise.all(
      Array.from({ length: 3 }, () =>
        cardFactory.create({
          userId: user.id,
          topicId: topics[0]!.id,
          updatedAt: tied
        })
      )
    )
    const later = await topicFactory.create({
      userId: user.id,
      title: 'later',
      updatedAt: new Date(BASE + 6000)
    })

    const all = await pullAll(user.id, 2)
    expect(new Set(all.topicIds)).toEqual(
      new Set([...topics.map(t => t.id), later.id])
    )
    expect(new Set(all.cardIds)).toEqual(new Set(cards.map(c => c.id)))
  })

  it('only returns the caller’s rows, even when another user shares timestamps', async () => {
    const user = await userFactory.create()
    const other = await userFactory.create()
    const updatedAt = new Date(BASE)
    const mine = await topicFactory.create({ userId: user.id, updatedAt })
    const myCard = await cardFactory.create({
      userId: user.id,
      topicId: mine.id,
      updatedAt
    })
    const theirs = await topicFactory.create({ userId: other.id, updatedAt })
    const theirCard = await cardFactory.create({
      userId: other.id,
      topicId: theirs.id,
      updatedAt
    })

    const all = await pullAll(user.id, 2)
    expect(all.topicIds).toEqual([mine.id])
    expect(all.cardIds).toEqual([myCard.id])

    const bootstrapped = await bootstrap({
      userId: other.id,
      deviceId: crypto.randomUUID()
    })
    expect(
      bootstrapped.records.map(r => (r.topic ?? r.card)?.id).sort()
    ).toEqual([theirs.id, theirCard.id].sort())
  })

  it('delivers a late edit with an old updatedAt to a peer pulling from its advanced cursor', async () => {
    const user = await userFactory.create()
    const offlineDevice = crypto.randomUUID()
    await topicFactory.create({
      userId: user.id,
      title: 'recent',
      updatedAt: new Date(BASE + 10_000)
    })
    const peerCursor = (
      await pullChanges({ userId: user.id, since: INITIAL_CURSOR })
    ).watermark
    expect(peerCursor).toBe('1')

    vi.mocked(publishFanout).mockClear()
    const staleId = crypto.randomUUID()
    await applyPushBatch({
      userId: user.id,
      deviceId: offlineDevice,
      mutations: [
        topicUpsert({
          id: staleId,
          title: 'stale',
          updatedAt: BASE + 1000,
          deviceId: offlineDevice
        })
      ]
    })

    const fromPeerCursor = await pullChanges({
      userId: user.id,
      since: peerCursor
    })
    expect(fromPeerCursor.records.map(r => r.topic?.id)).toEqual([staleId])
    expect(fromPeerCursor.watermark).toBe('2')
    expect(fromPeerCursor.records[0]?.topic?.updatedAt).toBe(BASE + 1000)

    const caughtUp = await pullChanges({
      userId: user.id,
      since: fromPeerCursor.watermark
    })
    expect(caughtUp.records).toHaveLength(0)
    expect(caughtUp.watermark).toBe('2')
  })

  it('treats a legacy ISO cursor as a full re-pull', async () => {
    const user = await userFactory.create()
    const topic = await topicFactory.create({ userId: user.id })

    const delta = await pullChanges({
      userId: user.id,
      since: new Date(BASE).toISOString()
    })
    expect(delta.records.map(r => r.topic?.id)).toEqual([topic.id])
  })

  it('pages in server-sequence order regardless of updatedAt', async () => {
    const user = await userFactory.create()
    const newerClock = await topicFactory.create({
      userId: user.id,
      title: 'first-in',
      updatedAt: new Date(BASE + 9000)
    })
    const olderClock = await topicFactory.create({
      userId: user.id,
      title: 'second-in',
      updatedAt: new Date(BASE)
    })

    const first = await pullChanges({
      userId: user.id,
      since: INITIAL_CURSOR,
      limit: 1
    })
    expect(first.records.map(r => r.topic?.id)).toEqual([newerClock.id])
    expect(first.more).toBe(true)

    const second = await pullChanges({
      userId: user.id,
      since: first.watermark,
      limit: 1
    })
    expect(second.records.map(r => r.topic?.id)).toEqual([olderClock.id])
    expect(second.more).toBe(false)
  })

  it('assigns unique, gap-free sequences to concurrent pushes from different devices', async () => {
    const user = await userFactory.create()
    const topicId = crypto.randomUUID()
    const devices = Array.from({ length: 6 }, () => crypto.randomUUID())
    await applyPushBatch({
      userId: user.id,
      deviceId: devices[0]!,
      mutations: [
        topicUpsert({
          id: topicId,
          title: 'parent',
          updatedAt: BASE,
          deviceId: devices[0]!
        })
      ]
    })

    await Promise.all(
      devices.map((deviceId, i) =>
        applyPushBatch({
          userId: user.id,
          deviceId,
          mutations: [
            cardUpsert({
              id: crypto.randomUUID(),
              topicId,
              updatedAt: BASE + i,
              deviceId
            })
          ]
        })
      )
    )

    const seqs = (
      await getTestPrisma().card.findMany({
        where: { userId: user.id },
        select: { serverSeq: true },
        orderBy: { serverSeq: 'asc' }
      })
    ).map(c => c.serverSeq)
    expect(seqs).toEqual([2n, 3n, 4n, 5n, 6n, 7n])
    const owner = await getTestPrisma().user.findUniqueOrThrow({
      where: { id: user.id }
    })
    expect(owner.syncSeq).toBe(7n)

    const all = await pullAll(user.id, 2)
    expect(all.cardIds).toHaveLength(6)
  })

  it('does not consume a sequence for a push that loses LWW', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    const topic = await topicFactory.create({
      userId: user.id,
      updatedAt: new Date(BASE + 10_000)
    })
    const cursor = (
      await pullChanges({ userId: user.id, since: INITIAL_CURSOR })
    ).watermark

    await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        topicUpsert({
          id: topic.id,
          title: 'older edit',
          updatedAt: BASE,
          deviceId
        })
      ]
    })

    const delta = await pullChanges({ userId: user.id, since: cursor })
    expect(delta.records).toHaveLength(0)
  })

  it('moves a row to the head of the sequence each time it is rewritten', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    const topic = await topicFactory.create({
      userId: user.id,
      updatedAt: new Date(BASE)
    })
    const cursor = (
      await pullChanges({ userId: user.id, since: INITIAL_CURSOR })
    ).watermark

    await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        topicUpsert({
          id: topic.id,
          title: 'renamed',
          updatedAt: BASE + 5000,
          deviceId
        })
      ]
    })

    const delta = await pullChanges({ userId: user.id, since: cursor })
    expect(delta.records.map(r => r.topic?.title)).toEqual(['renamed'])
  })
})

describe('future-dated updatedAt clamp', () => {
  it('clamps a far-future edit to the server clock plus skew, in storage and fanout', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    const topicId = crypto.randomUUID()
    const before = Date.now()

    await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        topicUpsert({
          id: topicId,
          title: 'from the future',
          updatedAt: before + 400 * DAY,
          deviceId
        })
      ]
    })

    const after = Date.now()
    const stored = await getTestPrisma().topic.findUniqueOrThrow({
      where: { id: topicId }
    })
    expect(stored.updatedAt.getTime()).toBeGreaterThanOrEqual(
      before + MAX_FUTURE_SKEW_MS
    )
    expect(stored.updatedAt.getTime()).toBeLessThanOrEqual(
      after + MAX_FUTURE_SKEW_MS
    )

    const fanout = vi
      .mocked(publishFanout)
      .mock.calls.map(([arg]) => arg.envelope)
      .find(e => e.kind === 'pullDelta')
    expect(
      fanout?.kind === 'pullDelta' && fanout.pullDelta.records[0]?.topic
    ).toMatchObject({ updatedAt: stored.updatedAt.getTime() })
  })

  it('clamps card upserts and deletes too', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    await addActiveDevice(user.id)
    const topic = await topicFactory.create({ userId: user.id })
    const cardId = crypto.randomUUID()
    const future = Date.now() + 400 * DAY

    await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        cardUpsert({
          id: cardId,
          topicId: topic.id,
          updatedAt: future,
          deviceId
        })
      ]
    })
    await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        deleteMutation({
          table: 'cards',
          recordId: cardId,
          updatedAt: future + DAY,
          deviceId
        })
      ]
    })

    const stored = await getTestPrisma().card.findUniqueOrThrow({
      where: { id: cardId }
    })
    const limit = Date.now() + MAX_FUTURE_SKEW_MS
    expect(stored.updatedAt.getTime()).toBeLessThanOrEqual(limit)
    expect(stored.deletedAt?.getTime()).toBeLessThanOrEqual(limit)
  })
})

describe('applyPushBatch fanout watermark', () => {
  it('leaves the cursor empty so a fanout delta never advances a client past unpulled rows', async () => {
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
      ''
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

    const { records } = await pullChanges({
      userId: user.id,
      since: INITIAL_CURSOR
    })
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
    let pulled = await pullChanges({ userId: user.id, since: INITIAL_CURSOR })
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
    pulled = await pullChanges({ userId: user.id, since: INITIAL_CURSOR })
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
        since: INITIAL_CURSOR
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

describe('applyPushBatch edit after a lost ack', () => {
  it('stores the edit pushed under a fresh opId after the first push landed unacknowledged', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    const topic = await topicFactory.create({
      userId: user.id,
      updatedAt: new Date(BASE)
    })
    const cardId = crypto.randomUUID()
    const firstOpId = crypto.randomUUID()
    const secondOpId = crypto.randomUUID()
    const push = (mutation: Mutation) =>
      applyPushBatch({ userId: user.id, deviceId, mutations: [mutation] })

    // Push lands, ack is lost; the client then edits and re-pushes the same record.
    await push(
      cardUpsert({
        id: cardId,
        topicId: topic.id,
        updatedAt: BASE + 1000,
        deviceId,
        body: 'before',
        opId: firstOpId
      })
    )
    const ack = await push(
      cardUpsert({
        id: cardId,
        topicId: topic.id,
        updatedAt: BASE + 2000,
        deviceId,
        body: 'after',
        opId: secondOpId
      })
    )

    expect(ack.acceptedOpIds).toEqual([secondOpId])
    expect(await wasOpApplied(user.id, secondOpId)).toBe(true)
    const { records } = await pullChanges({
      userId: user.id,
      since: INITIAL_CURSOR
    })
    const stored = records.find(r => r.card)?.card
    expect(JSON.parse(stored!.dataJson)).toEqual({ body: 'after' })
    expect(stored!.updatedAt).toBe(BASE + 2000)
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
    const { records } = await pullChanges({
      userId: user.id,
      since: INITIAL_CURSOR
    })
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
    const { records } = await pullChanges({
      userId: user.id,
      since: INITIAL_CURSOR
    })
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
    const { records } = await pullChanges({
      userId: user.id,
      since: INITIAL_CURSOR
    })
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

    const { records } = await pullChanges({
      userId: user.id,
      since: INITIAL_CURSOR
    })
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

    // Device A confirms by asking for the next range; the lagging one catches up.
    expect(
      await prisma.topic.findUnique({ where: { id: topic.id } })
    ).not.toBeNull()
    await bootstrap({
      userId: user.id,
      deviceId: deviceA,
      cursor: delta.watermark
    })
    expect(
      await prisma.topic.findUnique({ where: { id: topic.id } })
    ).not.toBeNull()
    await bootstrap({
      userId: user.id,
      deviceId: laggingDevice,
      cursor: delta.watermark
    })
    expect(
      await prisma.topic.findUnique({ where: { id: topic.id } })
    ).toBeNull()
  })

  it('does not purge a late old-timestamp delete that a device has not pulled yet', async () => {
    const user = await userFactory.create()
    const pusher = crypto.randomUUID()
    const reader = crypto.randomUUID()
    const prisma = getTestPrisma()
    const now = Date.now()
    const doomed = await topicFactory.create({
      userId: user.id,
      title: 'doomed',
      updatedAt: new Date(now - 50 * DAY)
    })
    await topicFactory.create({
      userId: user.id,
      title: 'recent',
      updatedAt: new Date(now - DAY)
    })

    // Both devices have pulled everything so far; their cursors are past "recent".
    const caughtUp = await bootstrap({ userId: user.id, deviceId: reader })
    for (const deviceId of [reader, pusher]) {
      await bootstrap({ userId: user.id, deviceId, cursor: caughtUp.watermark })
    }

    // An offline edit lands late with a delete stamped before the reader's
    // newest row. Purging on timestamps would drop it before the reader sees it.
    await applyPushBatch({
      userId: user.id,
      deviceId: pusher,
      mutations: [
        deleteMutation({
          table: 'topics',
          recordId: doomed.id,
          updatedAt: now - 40 * DAY,
          deviceId: pusher
        })
      ]
    })
    await finishSyncCycle({
      userId: user.id,
      deviceId: pusher,
      cursor: caughtUp.watermark
    })

    expect(
      await prisma.topic.findUnique({ where: { id: doomed.id } })
    ).not.toBeNull()
    const delta = await pullChanges({
      userId: user.id,
      since: caughtUp.watermark
    })
    expect(delta.records[0]?.topic).toMatchObject({
      id: doomed.id,
      deletedAt: now - 40 * DAY
    })
  })
})

describe('tombstone purge waits for the device to confirm', () => {
  it('keeps a tombstone in the response that delivers it until the device sends a later cursor', async () => {
    const user = await userFactory.create()
    const deleter = crypto.randomUUID()
    const reader = crypto.randomUUID()
    const prisma = getTestPrisma()
    const topic = await topicFactory.create({ userId: user.id })
    const start = await bootstrap({ userId: user.id, deviceId: reader })
    await bootstrap({
      userId: user.id,
      deviceId: deleter,
      cursor: start.watermark
    })
    await bootstrap({
      userId: user.id,
      deviceId: reader,
      cursor: start.watermark
    })

    await applyPushBatch({
      userId: user.id,
      deviceId: deleter,
      mutations: [
        deleteMutation({
          table: 'topics',
          recordId: topic.id,
          updatedAt: Date.now(),
          deviceId: deleter
        })
      ]
    })
    const deleterDelta = await bootstrap({
      userId: user.id,
      deviceId: deleter,
      cursor: start.watermark
    })
    // The reader is handed the tombstone but has not applied it yet; it may
    // still hold a queued edit for the row and push after a purge.
    const readerDelta = await bootstrap({
      userId: user.id,
      deviceId: reader,
      cursor: start.watermark
    })
    expect(readerDelta.records[0]?.topic?.deletedAt).not.toBeNull()
    expect(
      await prisma.topic.findUnique({ where: { id: topic.id } })
    ).not.toBeNull()

    // Both devices confirm by asking for the next range.
    for (const deviceId of [deleter, reader]) {
      await finishSyncCycle({
        userId: user.id,
        deviceId,
        cursor: deleterDelta.watermark
      })
    }
    expect(
      await prisma.topic.findUnique({ where: { id: topic.id } })
    ).toBeNull()
  })
})

describe('serverSeq migration backfill', () => {
  it('numbers existing rows per user in updatedAt order, topics before cards', async () => {
    const prisma = getTestPrisma()
    const user = await userFactory.create()
    const other = await userFactory.create()
    const topicLate = await topicFactory.create({
      userId: user.id,
      updatedAt: new Date(BASE + 2000),
      serverSeq: 0n
    })
    const topicEarly = await topicFactory.create({
      userId: user.id,
      updatedAt: new Date(BASE),
      serverSeq: 0n
    })
    const card = await cardFactory.create({
      userId: user.id,
      topicId: topicLate.id,
      updatedAt: new Date(BASE - 5000),
      serverSeq: 0n
    })
    const otherTopic = await topicFactory.create({
      userId: other.id,
      serverSeq: 0n
    })
    await prisma.user.updateMany({ data: { syncSeq: 0n } })

    const migration = readFileSync(
      new URL(
        '../../prisma/migrations/20261103120000_server_seq_cursor/migration.sql',
        import.meta.url
      ),
      'utf8'
    )
    const backfill = migration.slice(
      migration.indexOf('UPDATE "topics"'),
      migration.indexOf('DROP INDEX')
    )
    for (const statement of backfill.split(';').filter(s => s.trim())) {
      await prisma.$executeRawUnsafe(statement)
    }

    const seqOf = async (kind: 'topic' | 'card', id: string) =>
      kind === 'topic'
        ? (await prisma.topic.findUniqueOrThrow({ where: { id } })).serverSeq
        : (await prisma.card.findUniqueOrThrow({ where: { id } })).serverSeq
    expect(await seqOf('topic', topicEarly.id)).toBe(1n)
    expect(await seqOf('topic', topicLate.id)).toBe(2n)
    expect(await seqOf('card', card.id)).toBe(3n)
    expect(await seqOf('topic', otherTopic.id)).toBe(1n)
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).syncSeq
    ).toBe(3n)
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).syncSeq
    ).toBe(1n)

    const delta = await pullChanges({ userId: user.id, since: INITIAL_CURSOR })
    expect(delta.watermark).toBe('3')
  })
})
