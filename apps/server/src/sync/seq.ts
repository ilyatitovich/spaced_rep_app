import type { Mutation } from '@spaced-rep/sync-protocol'
import type { Prisma } from '../generated/prisma/client.js'

/**
 * Per-user server sequence (ADR-1). Every row the sync service writes gets the
 * next value, and pull cursors and tombstone purging key off it, not off the
 * client-supplied `updatedAt`.
 *
 * Commit order must equal sequence order, otherwise a client could pull seq 6,
 * move its cursor to 6, and then miss seq 5 committing late. The user's row is
 * therefore locked as the first statement of every apply transaction, which
 * serializes applies per user until commit. FOR NO KEY UPDATE keeps it from
 * blocking the foreign-key checks of unrelated inserts (sessions, devices).
 */
export interface SeqAllocator {
  next: () => Promise<bigint>
}

export async function lockUserSeq(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<SeqAllocator> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`
  if (locked.length === 0) throw new Error(`Cannot sync: no user ${userId}`)

  return {
    async next() {
      const rows = await tx.$queryRaw<{ sync_seq: bigint }[]>`
        UPDATE users SET sync_seq = sync_seq + 1 WHERE id = ${userId}::uuid
        RETURNING sync_seq`
      const row = rows[0]
      if (!row) throw new Error(`Cannot sync: no user ${userId}`)
      return row.sync_seq
    }
  }
}

/**
 * Interim guard: `updatedAt` still decides last-write-wins, so a device whose
 * clock runs far ahead would otherwise beat every honest edit indefinitely.
 * Timestamps past the server clock plus this skew are pulled back to it.
 */
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000

export function clampFutureTime(ms: number, now: number): number {
  return Math.min(ms, now + MAX_FUTURE_SKEW_MS)
}

export function clampMutationTimes(mutation: Mutation, now: number): Mutation {
  const clamp = (ms: number) => clampFutureTime(ms, now)
  const clampNullable = (ms: number | null) => (ms === null ? null : clamp(ms))
  return {
    ...mutation,
    updatedAt: clamp(mutation.updatedAt),
    ...(mutation.topic
      ? {
          topic: {
            ...mutation.topic,
            updatedAt: clamp(mutation.topic.updatedAt),
            deletedAt: clampNullable(mutation.topic.deletedAt ?? null)
          }
        }
      : {}),
    ...(mutation.card
      ? {
          card: {
            ...mutation.card,
            updatedAt: clamp(mutation.card.updatedAt),
            deletedAt: clampNullable(mutation.card.deletedAt ?? null)
          }
        }
      : {})
  }
}
