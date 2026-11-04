import {
  INITIAL_CURSOR,
  PROTOCOL_VERSION,
  cursorFromSeq,
  createEnvelopeId,
  parseCursor,
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
import { clampMutationTimes, lockUserSeq, type SeqAllocator } from './seq.js'
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
  /** Pull cursor the device has caught up to. */
  cursor?: string
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
        lastPulledSeq: parseCursor(input.cursor ?? INITIAL_CURSOR),
        lastSeenAt: new Date(),
        userAgent: input.userAgent ?? null
      },
      update: {
        ...(input.cursor ? { lastPulledSeq: parseCursor(input.cursor) } : {}),
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
  seq: SeqAllocator
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
    db,
    seq: input.seq
  })
  const title =
    conflict && conflict.topicId === topic.id ? conflict.newTitle : data.title

  const serverSeq = await input.seq.next()
  await db.topic.upsert({
    where: { id: topic.id },
    create: { ...data, title, serverSeq },
    update: {
      title,
      serverSeq,
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
  seq: SeqAllocator
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
  const serverSeq = await input.seq.next()
  await db.card.upsert({
    where: { id: card.id },
    create: { ...data, serverSeq },
    update: {
      serverSeq,
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
  seq: SeqAllocator
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
        data: {
          deletedAt: now,
          updatedAt: now,
          serverSeq: await input.seq.next()
        }
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
      data: {
        deletedAt: now,
        updatedAt: now,
        serverSeq: await input.seq.next()
      }
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
    // First statement: serializes this user's applies so commit order == seq order.
    const seq = await lockUserSeq(tx, userId)
    if (mutation.operation === 'delete') {
      await applyDelete({ userId, deviceId, mutation, hardDelete, db: tx, seq })
    } else if (mutation.table === 'topics') {
      const result = await applyTopicUpsert({
        userId,
        deviceId,
        mutation,
        db: tx,
        seq
      })
      conflict = result.conflict
    } else {
      await applyCardUpsert({ userId, deviceId, mutation, db: tx, seq })
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
      // Fanout carries only this push, so it must not move a client's pull
      // cursor past rows the client has not pulled. Empty means "no cursor".
      watermark: '',
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
  const now = Date.now()
  const mutations = input.mutations.map(m => clampMutationTimes(m, now))
  const upserts = mutations.filter(m => m.operation === 'upsert')
  const deletes = mutations.filter(m => m.operation === 'delete')
  const ordered = [...upserts, ...deletes]

  const { batchMediaError, mediaErrorsByHash } = await loadBatchMediaErrors(
    input.userId,
    mutations
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
  /** Opaque cursor from a previous pull (see `parseCursor`). */
  since: string
  limit?: number
}): Promise<PullDelta> {
  const since = parseCursor(input.since)
  const limit = input.limit ?? PULL_PAGE_SIZE
  const where = { userId: input.userId, serverSeq: { gt: since } }

  // One sequence spans topics and cards, so the lowest `limit` rows of each
  // table contain the lowest `limit` rows overall.
  const [topics, cards] = await Promise.all([
    prisma.topic.findMany({
      where,
      orderBy: { serverSeq: 'asc' },
      take: limit + 1
    }),
    prisma.card.findMany({
      where,
      orderBy: { serverSeq: 'asc' },
      take: limit + 1
    })
  ])

  const merged = [
    ...topics.map(row => ({ kind: 'topic' as const, row })),
    ...cards.map(row => ({ kind: 'card' as const, row }))
  ].sort((x, y) => Number(x.row.serverSeq - y.row.serverSeq))
  const page = merged.slice(0, limit)

  // Topics first for FK ordering on client
  const records: SyncRecord[] = [
    ...page.flatMap(r =>
      r.kind === 'topic' ? [{ topic: dbTopicToRecord(r.row) }] : []
    ),
    ...page.flatMap(r =>
      r.kind === 'card' ? [{ card: dbCardToRecord(r.row) }] : []
    )
  ]

  return {
    records,
    watermark: cursorFromSeq(page.at(-1)?.row.serverSeq ?? since),
    more: merged.length > limit
  }
}

export async function bootstrap(input: {
  userId: string
  deviceId: string
  cursor?: string
  userAgent?: string | null | undefined
}): Promise<PullDelta> {
  const since = input.cursor ?? INITIAL_CURSOR
  const delta = await pullChanges({ userId: input.userId, since })
  // Report what the device sent, not what it is about to receive: it has not
  // applied this delta yet, and purging on it could strand a pending edit.
  await reportDevice({
    userId: input.userId,
    deviceId: input.deviceId,
    cursor: since,
    userAgent: input.userAgent
  })
  await purgeSyncedTombstones(input.userId)
  return delta
}

export async function finishSyncCycle(input: {
  userId: string
  deviceId: string
  cursor: string
  userAgent?: string | null | undefined
}): Promise<void> {
  await reportDevice({
    userId: input.userId,
    deviceId: input.deviceId,
    cursor: input.cursor,
    userAgent: input.userAgent
  })
  await purgeSyncedTombstones(input.userId)
}
