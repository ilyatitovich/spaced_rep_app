import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../shared/lib/prisma.js'
import { logger } from '../shared/lib/logger.js'
import type { TopicConflictResolved } from '@spaced-rep/sync-protocol'
import type { SeqAllocator } from './seq.js'

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

type Db = Prisma.TransactionClient | typeof prisma

/**
 * Server-side unique-title disambiguation (plan §4b approach C).
 * Loser keeps its id; title becomes "{title} ({shortId})". Cards stay on topic_id.
 */
export async function resolveTopicTitleConflict(input: {
  userId: string
  incomingId: string
  incomingTitle: string
  incomingUpdatedAt: Date
  incomingDeviceId: string
  db?: Db
  /** Allocates the sequence for the renamed loser so peers pull the rename. */
  seq: SeqAllocator
}): Promise<TopicConflictResolved | null> {
  const db = input.db ?? prisma
  const existing = await db.topic.findFirst({
    where: {
      userId: input.userId,
      title: input.incomingTitle,
      deletedAt: null,
      NOT: { id: input.incomingId }
    }
  })

  if (!existing) return null

  const incomingMs = input.incomingUpdatedAt.getTime()
  const existingMs = existing.updatedAt.getTime()

  // Winner keeps the canonical title; loser is renamed.
  const incomingWins =
    incomingMs > existingMs ||
    (incomingMs === existingMs &&
      input.incomingId.localeCompare(existing.id) > 0)

  const loserId = incomingWins ? existing.id : input.incomingId
  const loserTitle = incomingWins ? existing.title : input.incomingTitle
  const shortId = loserId.slice(0, 4)
  const newTitle = `${loserTitle} (${shortId})`
  const updatedAt = new Date()

  // Only update DB when the loser already exists (incoming may not be inserted yet).
  const loserExists = await db.topic.findUnique({
    where: { id: loserId },
    select: { id: true }
  })
  if (loserExists) {
    await db.topic.update({
      where: { id: loserId },
      data: { title: newTitle, updatedAt, serverSeq: await input.seq.next() }
    })
  }

  logger.info(
    {
      userId: input.userId,
      loserId,
      oldTitle: loserTitle,
      newTitle
    },
    'sync.conflict topic title resolved'
  )

  return {
    topicId: loserId,
    oldTitle: loserTitle,
    newTitle,
    reason: 'duplicate_title',
    updatedAt: updatedAt.getTime()
  }
}

export async function countOtherActiveDevices(
  userId: string,
  deviceId: string
): Promise<number> {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS)
  return prisma.syncDevice.count({
    where: {
      userId,
      id: { not: deviceId },
      revokedAt: null,
      lastSeenAt: { gt: cutoff }
    }
  })
}

/**
 * Drop tombstones every active device has confirmed. The boundary is the
 * lowest `lastPulledSeq` across active devices, so a delete that lands late
 * (old `updatedAt`, fresh `serverSeq`) is kept until each device has seen it.
 * A device confirms a sequence by sending it as its next `since`, never by
 * being handed it in a response: a device with a queued edit for the deleted
 * row could still push after the purge and resurrect it.
 */
export async function purgeSyncedTombstones(userId: string): Promise<void> {
  const ttlCutoff = new Date(Date.now() - ACTIVE_WINDOW_MS)

  const activeDevices = await prisma.syncDevice.findMany({
    where: { userId, revokedAt: null, lastSeenAt: { gt: ttlCutoff } },
    select: { lastPulledSeq: true }
  })

  await prisma.syncDevice.deleteMany({
    where: { userId, revokedAt: null, lastSeenAt: { lte: ttlCutoff } }
  })

  const minPulled = activeDevices.reduce<bigint | null>(
    (min, d) => (min === null || d.lastPulledSeq < min ? d.lastPulledSeq : min),
    null
  )
  // With no active device nothing can be waiting on a tombstone, but keep the
  // 30-day grace the old purge had before dropping anything.
  const purgeable =
    minPulled === null
      ? { deletedAt: { not: null, lte: ttlCutoff } }
      : { deletedAt: { not: null }, serverSeq: { lte: minPulled } }

  await prisma.card.deleteMany({ where: { userId, ...purgeable } })
  await prisma.topic.deleteMany({ where: { userId, ...purgeable } })
}

export { ACTIVE_WINDOW_MS }
