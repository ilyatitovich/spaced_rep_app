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

/**
 * Anything that is not a plain non-negative integer (a legacy ISO watermark
 * stored by an older client, an empty string) means "from the start". A full
 * re-pull is idempotent under LWW, so this is always safe.
 */
export function parseCursor(value: string): bigint {
  return DECIMAL.test(value) ? BigInt(value) : 0n
}

export function cursorFromSeq(seq: bigint): string {
  return seq.toString()
}

/** True when `next` is strictly ahead of `prev`. Clients only ever move forward. */
export function isCursorAhead(next: string, prev: string): boolean {
  return parseCursor(next) > parseCursor(prev)
}
