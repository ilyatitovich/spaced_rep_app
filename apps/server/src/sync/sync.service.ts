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
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../shared/lib/prisma.js'
import { logger } from '../shared/lib/logger.js'
import {
  BadRequestError,
  ForbiddenError,
  MediaRefError
} from '../shared/lib/errors.js'
import { PRO_DEVICE_LIMIT } from '../settings/billing/product.js'
import {
  ACTIVE_WINDOW_MS,
  countOtherActiveDevices,
  purgeSyncedTombstones,
  resolveTopicTitleConflict
} from './conflict.service.js'
import {
  cacheOpApplied,
  markOpApplied,
  pruneAppliedOps,
  wasOpApplied
} from './idempotency.service.js'

const RECORD_NOT_OWNED = 'Record not owned by user'
type Db = Prisma.TransactionClient
import { publishFanout } from './fanout.service.js'
import {
  cardRecordToDb,
  dbCardToRecord,
  dbTopicToRecord,
  shouldApplyIncoming,
  topicRecordToDb
} from './mappers.js'
import {
  checkReferencedMedia,
  collectBatchMediaRefs,
  mediaErrorForCardData
} from './media.service.js'

const EPOCH_ISO = new Date(0).toISOString()
const PULL_PAGE_SIZE = 500

export async function listSyncDevices(userId: string) {
  return prisma.syncDevice.findMany({
    where: { userId, revokedAt: null },
    select: {
      id: true,
      name: true,
      lastSeenAt: true,
      userAgent: true
    },
    orderBy: { lastSeenAt: 'desc' }
  })
}

export async function revokeSyncDevice(input: {
  userId: string
  deviceId: string
  currentDeviceId: string
}): Promise<{ revoked: boolean }> {
  if (input.deviceId === input.currentDeviceId) {
    throw new BadRequestError(
      'The current device cannot revoke itself',
      'CURRENT_DEVICE'
    )
  }
  const result = await prisma.syncDevice.updateMany({
    where: {
      id: input.deviceId,
      userId: input.userId,
      revokedAt: null
    },
    data: { revokedAt: new Date() }
  })
  return { revoked: result.count > 0 }
}

export async function reportDevice(input: {
  userId: string
  deviceId: string
  lastPulledAt?: string
  userAgent?: string | null | undefined
}): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`

    const existing = await tx.syncDevice.findUnique({
      where: { id: input.deviceId },
      select: { userId: true, revokedAt: true }
    })
    if (existing && existing.userId !== input.userId) {
      throw new ForbiddenError('Device belongs to another user', 'FORBIDDEN')
    }
    if (existing?.revokedAt) {
      throw new ForbiddenError('Device has been revoked', 'DEVICE_REVOKED')
    }

    if (!existing) {
      const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS)
      await tx.syncDevice.deleteMany({
        where: {
          userId: input.userId,
          revokedAt: null,
          lastSeenAt: { lte: cutoff }
        }
      })
      const activeDevices = await tx.syncDevice.count({
        where: {
          userId: input.userId,
          revokedAt: null,
          lastSeenAt: { gt: cutoff }
        }
      })
      if (activeDevices >= PRO_DEVICE_LIMIT) {
        throw new ForbiddenError(
          `Pro supports up to ${PRO_DEVICE_LIMIT} active devices`,
          'DEVICE_LIMIT'
        )
      }
    }

    await tx.syncDevice.upsert({
      where: { id: input.deviceId },
      create: {
        id: input.deviceId,
        userId: input.userId,
        lastPulledAt: new Date(input.lastPulledAt ?? EPOCH_ISO),
        lastSeenAt: new Date(),
        userAgent: input.userAgent ?? null
      },
      update: {
        ...(input.lastPulledAt
          ? { lastPulledAt: new Date(input.lastPulledAt) }
          : {}),
        lastSeenAt: new Date(),
        // Don't clobber a known UA when a caller omits it (e.g. bootstrap before the fix).
        ...(input.userAgent ? { userAgent: input.userAgent } : {})
      }
    })
  })
}

async function applyTopicUpsert(input: {
  userId: string
  deviceId: string
  mutation: Mutation
  db: Db
}): Promise<{ conflict: TopicConflictResolved | null }> {
  const { db } = input
  const topic = input.mutation.topic
  if (!topic) {
    throw new BadRequestError(
      'Topic upsert missing payload',
      'VALIDATION_ERROR'
    )
  }

  const existing = await db.topic.findUnique({ where: { id: topic.id } })
  if (existing && existing.userId !== input.userId) {
    throw new BadRequestError(RECORD_NOT_OWNED, 'FORBIDDEN')
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

  // Resolve before write — a unique violation aborts the surrounding Postgres tx.
  const conflict = await resolveTopicTitleConflict({
    userId: input.userId,
    incomingId: topic.id,
    incomingTitle: topic.title,
    incomingUpdatedAt: new Date(topic.updatedAt),
    incomingDeviceId: input.deviceId,
    db
  })
  const title =
    conflict && conflict.topicId === topic.id ? conflict.newTitle : data.title

  await db.topic.upsert({
    where: { id: topic.id },
    create: { ...data, title },
    update: {
      title,
      pivot: data.pivot,
      week: data.week,
      nextUpdateDate: data.nextUpdateDate,
      isArchived: data.isArchived ?? false,
      updatedAt: data.updatedAt,
      deletedAt: null
    }
  })

  return { conflict }
}

async function applyCardUpsert(input: {
  userId: string
  deviceId: string
  mutation: Mutation
  db: Db
}): Promise<void> {
  const { db } = input
  const card = input.mutation.card
  if (!card) {
    throw new BadRequestError('Card upsert missing payload', 'VALIDATION_ERROR')
  }

  const topic = await db.topic.findUnique({
    where: { id: card.topicId },
    select: { userId: true }
  })
  if (!topic || topic.userId !== input.userId) {
    throw new BadRequestError('Topic not owned by user', 'FORBIDDEN')
  }

  const existing = await db.card.findUnique({ where: { id: card.id } })
  if (existing && existing.userId !== input.userId) {
    throw new BadRequestError(RECORD_NOT_OWNED, 'FORBIDDEN')
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
  await db.card.upsert({
    where: { id: card.id },
    create: data,
    update: {
      topicId: data.topicId,
      level: data.level ?? 0,
      data: data.data,
      reviewDate: data.reviewDate ?? null,
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
  db: Db
}): Promise<void> {
  const { db } = input
  const { table, recordId, updatedAt } = input.mutation
  const now = new Date(updatedAt || Date.now())

  if (table === 'topics') {
    const existing = await db.topic.findUnique({ where: { id: recordId } })
    if (!existing) return
    if (existing.userId !== input.userId) {
      throw new BadRequestError(RECORD_NOT_OWNED, 'FORBIDDEN')
    }
    if (existing.updatedAt.getTime() > now.getTime()) return
    if (input.hardDelete) {
      await db.topic.delete({ where: { id: recordId } }).catch(() => undefined)
    } else {
      await db.topic.update({
        where: { id: recordId },
        data: { deletedAt: now, updatedAt: now }
      })
    }
    return
  }

  const existing = await db.card.findUnique({ where: { id: recordId } })
  if (!existing) return
  if (existing.userId !== input.userId) {
    throw new BadRequestError(RECORD_NOT_OWNED, 'FORBIDDEN')
  }
  if (existing.updatedAt.getTime() > now.getTime()) return
  if (input.hardDelete) {
    await db.card.delete({ where: { id: recordId } }).catch(() => undefined)
  } else {
    await db.card.update({
      where: { id: recordId },
      data: { deletedAt: now, updatedAt: now }
    })
  }
}

/** Media checks stay outside the tx — they are network/R2, not Postgres. */
async function assertCardMediaReady(
  mutation: Mutation,
  batchMediaError: MediaRefError | null,
  mediaErrorsByHash: Map<string, MediaRefError>
): Promise<void> {
  if (mutation.operation !== 'upsert' || mutation.table !== 'cards') return
  if (batchMediaError) throw batchMediaError
  if (!mutation.card) return
  const mediaError = await mediaErrorForCardData(
    mutation.card.dataJson,
    mediaErrorsByHash
  )
  if (mediaError) throw mediaError
}

async function applyMutationWithMark(input: {
  userId: string
  deviceId: string
  mutation: Mutation
  hardDelete: boolean
}): Promise<TopicConflictResolved | null> {
  const { userId, deviceId, mutation, hardDelete } = input
  let conflict: TopicConflictResolved | null = null

  await prisma.$transaction(async tx => {
    if (mutation.operation === 'delete') {
      await applyDelete({ userId, deviceId, mutation, hardDelete, db: tx })
    } else if (mutation.table === 'topics') {
      const result = await applyTopicUpsert({
        userId,
        deviceId,
        mutation,
        db: tx
      })
      conflict = result.conflict
    } else {
      await applyCardUpsert({ userId, deviceId, mutation, db: tx })
    }

    await markOpApplied({ userId, opId: mutation.opId, deviceId, db: tx })
  })

  return conflict
}

function rejectedOpFromError(opId: string, err: unknown): RejectedOp {
  const message = err instanceof Error ? err.message : 'Unknown error'
  if (err instanceof MediaRefError) {
    return {
      opId,
      code: err.code,
      message,
      retryable: err.retryable
    }
  }
  return { opId, code: 'APPLY_FAILED', message, retryable: true }
}

async function loadBatchMediaErrors(
  userId: string,
  mutations: Mutation[]
): Promise<{
  batchMediaError: MediaRefError | null
  mediaErrorsByHash: Map<string, MediaRefError>
}> {
  const { refs, error: batchMediaError } =
    await collectBatchMediaRefs(mutations)
  if (batchMediaError != null) {
    return { batchMediaError, mediaErrorsByHash: new Map() }
  }
  return {
    batchMediaError: null,
    mediaErrorsByHash: await checkReferencedMedia({ userId, refs })
  }
}

async function applyOrderedMutations(input: {
  userId: string
  deviceId: string
  ordered: Mutation[]
  hardDelete: boolean
  batchMediaError: MediaRefError | null
  mediaErrorsByHash: Map<string, MediaRefError>
}): Promise<{
  acceptedOpIds: string[]
  rejected: RejectedOp[]
  conflicts: TopicConflictResolved[]
}> {
  const acceptedOpIds: string[] = []
  const rejected: RejectedOp[] = []
  const conflicts: TopicConflictResolved[] = []

  for (const mutation of input.ordered) {
    try {
      if (await wasOpApplied(input.userId, mutation.opId)) {
        acceptedOpIds.push(mutation.opId)
        continue
      }

      await assertCardMediaReady(
        mutation,
        input.batchMediaError,
        input.mediaErrorsByHash
      )
      const conflict = await applyMutationWithMark({
        userId: input.userId,
        deviceId: input.deviceId,
        mutation,
        hardDelete: input.hardDelete
      })
      await cacheOpApplied(input.userId, mutation.opId)
      if (conflict) conflicts.push(conflict)
      acceptedOpIds.push(mutation.opId)
    } catch (err) {
      logger.error(
        { err, opId: mutation.opId, userId: input.userId },
        'sync.push mutation failed'
      )
      rejected.push(rejectedOpFromError(mutation.opId, err))
    }
  }

  return { acceptedOpIds, rejected, conflicts }
}

function fanoutRecordForMutation(mutation: Mutation): SyncRecord | null {
  if (mutation.operation === 'upsert') {
    if (mutation.topic) return { topic: mutation.topic }
    if (mutation.card) return { card: mutation.card }
    return null
  }
  if (mutation.table === 'topics') {
    return {
      topic: {
        id: mutation.recordId,
        title: '',
        pivot: 0,
        weekJson: '[]',
        nextUpdateDate: 0,
        isArchived: false,
        updatedAt: mutation.updatedAt,
        deletedAt: mutation.updatedAt
      }
    }
  }
  return {
    card: {
      id: mutation.recordId,
      topicId: '',
      level: 0,
      dataJson: '{}',
      updatedAt: mutation.updatedAt,
      deletedAt: mutation.updatedAt
    }
  }
}

async function buildFanoutRecords(
  ordered: Mutation[],
  acceptedOpIds: string[],
  conflicts: TopicConflictResolved[]
): Promise<SyncRecord[]> {
  const accepted = new Set(acceptedOpIds)
  const records: SyncRecord[] = []
  for (const mutation of ordered) {
    if (!accepted.has(mutation.opId)) continue
    const record = fanoutRecordForMutation(mutation)
    if (record) records.push(record)
  }
  for (const c of conflicts) {
    const row = await prisma.topic.findUnique({ where: { id: c.topicId } })
    if (row) records.push({ topic: dbTopicToRecord(row) })
  }
  return records
}

async function publishPushFanout(input: {
  userId: string
  deviceId: string
  records: SyncRecord[]
  conflicts: TopicConflictResolved[]
}): Promise<void> {
  if (input.records.length === 0) return

  const envelope: SyncEnvelope = {
    version: PROTOCOL_VERSION,
    messageId: createEnvelopeId(),
    deviceId: input.deviceId,
    sentAt: Date.now(),
    kind: 'pullDelta',
    pullDelta: {
      records: input.records,
      watermark: new Date(
        Math.max(...input.records.map(r => (r.topic ?? r.card)?.updatedAt ?? 0))
      ).toISOString(),
      more: false
    }
  }
  await publishFanout({
    userId: input.userId,
    envelope,
    excludeDeviceId: input.deviceId
  })

  for (const c of input.conflicts) {
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

export async function applyPushBatch(input: {
  userId: string
  deviceId: string
  mutations: Mutation[]
}): Promise<PushAck> {
  const otherActive = await countOtherActiveDevices(
    input.userId,
    input.deviceId
  )
  const hardDelete = otherActive === 0

  // Upserts before deletes within the batch
  const upserts = input.mutations.filter(m => m.operation === 'upsert')
  const deletes = input.mutations.filter(m => m.operation === 'delete')
  const ordered = [...upserts, ...deletes]

  const { batchMediaError, mediaErrorsByHash } = await loadBatchMediaErrors(
    input.userId,
    input.mutations
  )
  const { acceptedOpIds, rejected, conflicts } = await applyOrderedMutations({
    userId: input.userId,
    deviceId: input.deviceId,
    ordered,
    hardDelete,
    batchMediaError,
    mediaErrorsByHash
  })

  await pruneAppliedOps(input.userId)

  const fanoutRecords = await buildFanoutRecords(
    ordered,
    acceptedOpIds,
    conflicts
  )
  await publishPushFanout({
    userId: input.userId,
    deviceId: input.deviceId,
    records: fanoutRecords,
    conflicts
  })

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

  const merged = [
    ...topics.map(row => ({ kind: 'topic' as const, row })),
    ...cards.map(row => ({ kind: 'card' as const, row }))
  ].sort(
    (x, y) =>
      x.row.updatedAt.getTime() - y.row.updatedAt.getTime() ||
      x.row.id.localeCompare(y.row.id)
  )
  const cut = merged.slice(0, limit)

  // The cursor is a bare timestamp matched with `gt`, so rows sharing the last
  // row's updatedAt would be skipped by the next page. Include every tie.
  const boundary = cut.at(-1)?.row.updatedAt
  const [tiedTopics, tiedCards] = boundary
    ? await Promise.all([
        prisma.topic.findMany({
          where: { userId: input.userId, updatedAt: boundary }
        }),
        prisma.card.findMany({
          where: { userId: input.userId, updatedAt: boundary }
        })
      ])
    : [[], []]
  const seen = new Set(cut.map(r => r.row.id))
  const selected = [
    ...cut,
    ...tiedTopics
      .filter(row => !seen.has(row.id))
      .map(row => ({ kind: 'topic' as const, row })),
    ...tiedCards
      .filter(row => !seen.has(row.id))
      .map(row => ({ kind: 'card' as const, row }))
  ]

  // Topics first for FK ordering on client
  const records: SyncRecord[] = [
    ...selected.flatMap(r =>
      r.kind === 'topic' ? [{ topic: dbTopicToRecord(r.row) }] : []
    ),
    ...selected.flatMap(r =>
      r.kind === 'card' ? [{ card: dbCardToRecord(r.row) }] : []
    )
  ]

  const last = selected.at(-1)
  const more =
    merged.length > limit || topics.length === limit || cards.length === limit

  return {
    records,
    watermark: (last?.row.updatedAt ?? since).toISOString(),
    more
  }
}

export async function bootstrap(input: {
  userId: string
  deviceId: string
  lastPulledAt?: string
  userAgent?: string | null | undefined
}): Promise<PullDelta> {
  const since = input.lastPulledAt || EPOCH_ISO
  const delta = await pullChanges({ userId: input.userId, since })
  await reportDevice({
    userId: input.userId,
    deviceId: input.deviceId,
    lastPulledAt: delta.watermark,
    userAgent: input.userAgent
  })
  await purgeSyncedTombstones(input.userId)
  return delta
}

export async function finishSyncCycle(input: {
  userId: string
  deviceId: string
  lastPulledAt: string
  userAgent?: string | null | undefined
}): Promise<void> {
  await reportDevice({
    userId: input.userId,
    deviceId: input.deviceId,
    lastPulledAt: input.lastPulledAt,
    userAgent: input.userAgent
  })
  await purgeSyncedTombstones(input.userId)
}
