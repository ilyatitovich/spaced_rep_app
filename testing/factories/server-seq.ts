import { getTestPrisma } from '../db/prisma.js'

/**
 * Hand out the next per-user server sequence the way the sync service does, so
 * rows seeded directly through Prisma are visible to cursor pulls.
 */
export async function nextServerSeq(userId: string): Promise<bigint> {
  const rows = await getTestPrisma().$queryRaw<{ sync_seq: bigint }[]>`
    UPDATE users SET sync_seq = sync_seq + 1 WHERE id = ${userId}::uuid
    RETURNING sync_seq`
  const row = rows[0]
  if (!row) throw new Error(`nextServerSeq: no user ${userId}`)
  return row.sync_seq
}
