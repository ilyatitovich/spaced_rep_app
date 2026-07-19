import {
  PROTOCOL_VERSION,
  createEnvelopeId,
  type Mutation,
  type PullDelta,
  type PushAck,
  type RejectedOp,
  type SyncEnvelope,
  type SyncRecord,
  type TopicConflictResolved
} from '@spaced-rep/sync-protocol'
import { prisma } from '../shared/lib/prisma.js'
import { logger } from '../shared/lib/logger.js'
import { BadRequestError } from '../shared/lib/errors.js'
import {
  countOtherActiveDevices,
  purgeSyncedTombstones,
  resolveTopicTitleConflict
} from './conflict.service.js'
import { markOpApplied, wasOpApplied } from './idempotency.service.js'
import { publishFanout } from './fanout.service.js'
import {
  cardRecordToDb,
  dbCardToRecord,
  dbTopicToRecord,
  shouldApplyIncoming,
  topicRecordToDb
} from './mappers.js'

const EPOCH_ISO = new Date(0).toISOString()
const PULL_PAGE_SIZE = 500

export async function reportDevice(input: {
  userId: string
  deviceId: string
  lastPulledAt: string
  userAgent?: string | null
}): Promise<void> {
  await prisma.syncDevice.upsert({
    where: { id: input.deviceId },
    create: {
      id: input.deviceId,
      userId: input.userId,
      lastPulledAt: new Date(input.lastPulledAt || EPOCH_ISO),
      lastSeenAt: new Date(),
      userAgent: input.userAgent ?? null
    },
    update: {
      lastPulledAt: new Date(input.lastPulledAt || EPOCH_ISO),
      lastSeenAt: new Date(),
      userAgent: input.userAgent ?? null
    }
  })
}

async function applyTopicUpsert(input: {
  userId: string
  deviceId: string
  mutation: Mutation
}): Promise<{ conflict: TopicConflictResolved | null }> {
  const topic = input.mutation.topic
  if (!topic) {
    throw new BadRequestError('Topic upsert missing payload', 'VALIDATION_ERROR')
  }

  const existing = await prisma.topic.findUnique({ where: { id: topic.id } })
  if (existing && existing.userId !== input.userId) {
    throw new BadRequestError('Record not owned by user', 'FORBIDDEN')
  }

  if (
    existing &&
    !shouldApplyIncoming(
      existing.updatedAt.getTime(),
      undefined,
      existing.id,
      topic.updatedAt,
      input.deviceId,
      topic.id
    )
  ) {
    return { conflict: null }
  }

  const data = topicRecordToDb(topic, input.userId)

  try {
    await prisma.topic.upsert({
      where: { id: topic.id },
      create: data,
      update: {
        title: data.title,
        pivot: data.pivot,
        week: data.week,
        nextUpdateDate: data.nextUpdateDate,
        updatedAt: data.updatedAt,
        deletedAt: null
      }
    })
  } catch (err) {
    // Unique title collision — resolve then retry
    const conflict = await resolveTopicTitleConflict({
      userId: input.userId,
      incomingId: topic.id,
      incomingTitle: topic.title,
      incomingUpdatedAt: new Date(topic.updatedAt),
      incomingDeviceId: input.deviceId
    })

    if (!conflict) throw err

    // After rename of loser, upsert again with possibly adjusted title
    const title =
      conflict.topicId === topic.id ? conflict.newTitle : topic.title

    await prisma.topic.upsert({
      where: { id: topic.id },
      create: { ...data, title },
      update: {
        title,
        pivot: data.pivot,
        week: data.week,
        nextUpdateDate: data.nextUpdateDate,
        updatedAt: data.updatedAt,
        deletedAt: null
      }
    })

    return { conflict }
  }

  // Proactive check: another live topic may already hold this title
  const conflict = await resolveTopicTitleConflict({
    userId: input.userId,
    incomingId: topic.id,
    incomingTitle: topic.title,
    incomingUpdatedAt: new Date(topic.updatedAt),
    incomingDeviceId: input.deviceId
  })

  return { conflict }
}

async function applyCardUpsert(input: {
  userId: string
  deviceId: string
  mutation: Mutation
}): Promise<void> {
  const card = input.mutation.card
  if (!card) {
    throw new BadRequestError('Card upsert missing payload', 'VALIDATION_ERROR')
  }

  const existing = await prisma.card.findUnique({ where: { id: card.id } })
  if (existing && existing.userId !== input.userId) {
    throw new BadRequestError('Record not owned by user', 'FORBIDDEN')
  }

  if (
    existing &&
    !shouldApplyIncoming(
      existing.updatedAt.getTime(),
      undefined,
      existing.id,
      card.updatedAt,
      input.deviceId,
      card.id
    )
  ) {
    return
  }

  const data = cardRecordToDb(card, input.userId)
  await prisma.card.upsert({
    where: { id: card.id },
    create: data,
    update: {
      topicId: data.topicId,
      level: data.level,
      data: data.data,
      reviewDate: data.reviewDate,
      updatedAt: data.updatedAt,
      deletedAt: null
    }
  })
}

async function applyDelete(input: {
  userId: string
  deviceId: string
  mutation: Mutation
  hardDelete: boolean
}): Promise<void> {
  const { table, recordId, updatedAt } = input.mutation
  const now = new Date(updatedAt || Date.now())

  if (table === 'topics') {
    const existing = await prisma.topic.findUnique({ where: { id: recordId } })
    if (!existing) return
    if (existing.userId !== input.userId) {
      throw new BadRequestError('Record not owned by user', 'FORBIDDEN')
    }
    if (input.hardDelete) {
      await prisma.topic.delete({ where: { id: recordId } }).catch(() => undefined)
    } else {
      await prisma.topic.update({
        where: { id: recordId },
        data: { deletedAt: now, updatedAt: now }
      })
    }
    return
  }

  const existing = await prisma.card.findUnique({ where: { id: recordId } })
  if (!existing) return
  if (existing.userId !== input.userId) {
    throw new BadRequestError('Record not owned by user', 'FORBIDDEN')
  }
  if (input.hardDelete) {
    await prisma.card.delete({ where: { id: recordId } }).catch(() => undefined)
  } else {
    await prisma.card.update({
      where: { id: recordId },
      data: { deletedAt: now, updatedAt: now }
    })
  }
}

export async function applyPushBatch(input: {
  userId: string
  deviceId: string
  mutations: Mutation[]
}): Promise<PushAck> {
  const acceptedOpIds: string[] = []
  const rejected: RejectedOp[] = []
  const conflicts: TopicConflictResolved[] = []

  const otherActive = await countOtherActiveDevices(
    input.userId,
    input.deviceId
  )
  const hardDelete = otherActive === 0

  // Upserts before deletes within the batch
  const upserts = input.mutations.filter(m => m.operation === 'upsert')
  const deletes = input.mutations.filter(m => m.operation === 'delete')
  const ordered = [...upserts, ...deletes]

  for (const mutation of ordered) {
    try {
      if (await wasOpApplied(input.userId, mutation.opId)) {
        acceptedOpIds.push(mutation.opId)
        continue
      }

      if (mutation.operation === 'upsert') {
        if (mutation.table === 'topics') {
          const result = await applyTopicUpsert({
            userId: input.userId,
            deviceId: input.deviceId,
            mutation
          })
          if (result.conflict) conflicts.push(result.conflict)
        } else {
          await applyCardUpsert({
            userId: input.userId,
            deviceId: input.deviceId,
            mutation
          })
        }
      } else {
        await applyDelete({
          userId: input.userId,
          deviceId: input.deviceId,
          mutation,
          hardDelete
        })
      }

      await markOpApplied({
        userId: input.userId,
        opId: mutation.opId,
        deviceId: input.deviceId
      })
      acceptedOpIds.push(mutation.opId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error(
        { err, opId: mutation.opId, userId: input.userId },
        'sync.push mutation failed'
      )
      rejected.push({
        opId: mutation.opId,
        code: 'APPLY_FAILED',
        message,
        retryable: true
      })
    }
  }

  const delta = await pullChanges({
    userId: input.userId,
    since: EPOCH_ISO,
    // Only broadcast what changed recently — use last 5s window for fanout
    limit: 100
  })

  // Narrow fanout: rebuild delta from accepted mutations' records
  const fanoutRecords: SyncRecord[] = []
  for (const mutation of ordered) {
    if (!acceptedOpIds.includes(mutation.opId)) continue
    if (mutation.operation === 'upsert') {
      if (mutation.topic) fanoutRecords.push({ topic: mutation.topic })
      if (mutation.card) fanoutRecords.push({ card: mutation.card })
    } else if (mutation.table === 'topics') {
      fanoutRecords.push({
        topic: {
          id: mutation.recordId,
          title: '',
          pivot: 0,
          weekJson: '[]',
          nextUpdateDate: 0,
          updatedAt: mutation.updatedAt,
          deletedAt: mutation.updatedAt
        }
      })
    } else {
      fanoutRecords.push({
        card: {
          id: mutation.recordId,
          topicId: '',
          level: 0,
          dataJson: '{}',
          updatedAt: mutation.updatedAt,
          deletedAt: mutation.updatedAt
        }
      })
    }
  }

  // Include conflict renames in fanout
  for (const c of conflicts) {
    const row = await prisma.topic.findUnique({ where: { id: c.topicId } })
    if (row) fanoutRecords.push({ topic: dbTopicToRecord(row) })
  }

  if (fanoutRecords.length > 0) {
    const envelope: SyncEnvelope = {
      version: PROTOCOL_VERSION,
      messageId: createEnvelopeId(),
      deviceId: input.deviceId,
      sentAt: Date.now(),
      kind: 'pullDelta',
      pullDelta: {
        records: fanoutRecords,
        watermark: delta.watermark,
        more: false
      }
    }
    await publishFanout({
      userId: input.userId,
      envelope,
      excludeDeviceId: input.deviceId
    })

    for (const c of conflicts) {
      await publishFanout({
        userId: input.userId,
        envelope: {
          version: PROTOCOL_VERSION,
          messageId: createEnvelopeId(),
          deviceId: input.deviceId,
          sentAt: Date.now(),
          kind: 'topicConflictResolved',
          topicConflictResolved: c
        }
      })
    }
  }

  logger.info(
    {
      userId: input.userId,
      deviceId: input.deviceId,
      accepted: acceptedOpIds.length,
      rejected: rejected.length,
      conflicts: conflicts.length
    },
    'sync.push'
  )

  return { acceptedOpIds, rejected, conflicts }
}

export async function pullChanges(input: {
  userId: string
  since: string
  limit?: number
}): Promise<PullDelta> {
  const since = new Date(input.since || EPOCH_ISO)
  const limit = input.limit ?? PULL_PAGE_SIZE

  const [topics, cards] = await Promise.all([
    prisma.topic.findMany({
      where: { userId: input.userId, updatedAt: { gt: since } },
      orderBy: { updatedAt: 'asc' },
      take: limit
    }),
    prisma.card.findMany({
      where: { userId: input.userId, updatedAt: { gt: since } },
      orderBy: { updatedAt: 'asc' },
      take: limit
    })
  ])

  // Topics first for FK ordering on client
  const records: SyncRecord[] = [
    ...topics.map(t => ({ topic: dbTopicToRecord(t) })),
    ...cards.map(c => ({ card: dbCardToRecord(c) }))
  ]

  let maxMs = since.getTime()
  for (const t of topics) maxMs = Math.max(maxMs, t.updatedAt.getTime())
  for (const c of cards) maxMs = Math.max(maxMs, c.updatedAt.getTime())

  const more = topics.length + cards.length >= limit * 2

  return {
    records,
    watermark: new Date(maxMs).toISOString(),
    more
  }
}

export async function bootstrap(input: {
  userId: string
  deviceId: string
  lastPulledAt?: string
}): Promise<PullDelta> {
  const since = input.lastPulledAt || EPOCH_ISO
  const delta = await pullChanges({ userId: input.userId, since })
  await reportDevice({
    userId: input.userId,
    deviceId: input.deviceId,
    lastPulledAt: delta.watermark
  })
  await purgeSyncedTombstones(input.userId)
  return delta
}

export async function finishSyncCycle(input: {
  userId: string
  deviceId: string
  lastPulledAt: string
  userAgent?: string | null
}): Promise<void> {
  await reportDevice({
    userId: input.userId,
    deviceId: input.deviceId,
    lastPulledAt: input.lastPulledAt,
    userAgent: input.userAgent
  })
  await purgeSyncedTombstones(input.userId)
}
