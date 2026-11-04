/**
 * Pull cursor (protocol v4).
 *
 * The cursor is the highest server-assigned sequence a device has seen,
 * serialized as a decimal string. It replaces the v3 cursor, which was the
 * client-supplied `updatedAt` and therefore could skip late-arriving edits.
 * Clients must treat it as opaque apart from these helpers. The wire fields
 * keep their v3 names (`since`, `watermark`, `lastPulledAt`).
 */

/** "Never pulled": the server returns everything. */
export const INITIAL_CURSOR = '0'

const DECIMAL = /^\d+$/

/** Sequences live in a Postgres bigint; anything larger cannot be a real cursor. */
const MAX_SEQ = 2n ** 63n - 1n

/**
 * Anything that is not a plain non-negative integer (a legacy ISO watermark
 * stored by an older client, an empty string) or does not fit a bigint column
 * means "from the start". A full re-pull is idempotent under LWW, so this is
 * always safe, and it keeps a hostile cursor from overflowing the query.
 */
export function parseCursor(value: string): bigint {
  if (!DECIMAL.test(value)) return 0n
  const seq = BigInt(value)
  return seq > MAX_SEQ ? 0n : seq
}

export function cursorFromSeq(seq: bigint): string {
  return seq.toString()
}

/** True when `next` is strictly ahead of `prev`. Clients only ever move forward. */
export function isCursorAhead(next: string, prev: string): boolean {
  return parseCursor(next) > parseCursor(prev)
}
