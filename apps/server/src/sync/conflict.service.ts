import { prisma } from '../shared/lib/prisma.js'
import { logger } from '../shared/lib/logger.js'
import type { TopicConflictResolved } from '@spaced-rep/sync-protocol'

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

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
}): Promise<TopicConflictResolved | null> {
  const existing = await prisma.topic.findFirst({
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
  const loserExists = await prisma.topic.findUnique({
    where: { id: loserId },
    select: { id: true }
  })
  if (loserExists) {
    await prisma.topic.update({
      where: { id: loserId },
      data: { title: newTitle, updatedAt }
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
      lastSeenAt: { gt: cutoff }
    }
  })
}

export async function purgeSyncedTombstones(userId: string): Promise<void> {
  const ttlCutoff = new Date(Date.now() - ACTIVE_WINDOW_MS)

  const activeDevices = await prisma.syncDevice.findMany({
    where: { userId, lastSeenAt: { gt: ttlCutoff } },
    select: { lastPulledAt: true }
  })

  const minPulled =
    activeDevices.length > 0
      ? new Date(Math.min(...activeDevices.map(d => d.lastPulledAt.getTime())))
      : ttlCutoff

  await prisma.syncDevice.deleteMany({
    where: { userId, lastSeenAt: { lte: ttlCutoff } }
  })

  await prisma.card.deleteMany({
    where: {
      userId,
      deletedAt: { not: null },
      OR: [{ deletedAt: { lte: minPulled } }, { deletedAt: { lt: ttlCutoff } }]
    }
  })

  await prisma.topic.deleteMany({
    where: {
      userId,
      deletedAt: { not: null },
      OR: [{ deletedAt: { lte: minPulled } }, { deletedAt: { lt: ttlCutoff } }]
    }
  })
}

export { ACTIVE_WINDOW_MS }
