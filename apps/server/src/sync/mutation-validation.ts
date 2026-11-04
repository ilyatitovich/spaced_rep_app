import type {
  CardRecord,
  Mutation,
  RejectedOp,
  TopicRecord
} from '@spaced-rep/sync-protocol'

/**
 * Checks the wire schema cannot express: things that would otherwise only fail
 * deep inside the apply transaction (a Postgres type error, `BigInt(1.5)`,
 * `JSON.parse`) and come back as a *retryable* failure the client replays until
 * it gives up. A malformed op can never succeed, so it is rejected up front as
 * `VALIDATION_ERROR` with `retryable: false`.
 */

const INT32_MAX = 2_147_483_647
const INT32_MIN = -2_147_483_648

function isValidDate(ms: number): boolean {
  return Number.isFinite(new Date(ms).getTime())
}

/** Stored in a Postgres bigint through `BigInt(...)`: must be a whole, safe number. */
function isBigIntSafe(value: number): boolean {
  return Number.isSafeInteger(value)
}

/** Postgres `text` and `jsonb` cannot hold a NUL (raw or as the \u0000 escape). */
function hasNul(text: string): boolean {
  return text.includes('\u0000') || text.includes(String.raw`\u0000`)
}

function isParseableJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

function timeProblem(label: string, ms: number | null | undefined) {
  return ms != null && !isValidDate(ms) ? `${label} is not a valid time` : null
}

function topicProblem(topic: TopicRecord): string | null {
  if (hasNul(topic.title)) return 'Topic title contains a NUL character'
  if (!isParseableJson(topic.weekJson) || hasNul(topic.weekJson)) {
    return 'Topic weekJson is not storable JSON'
  }
  if (!isBigIntSafe(topic.pivot) || !isBigIntSafe(topic.nextUpdateDate)) {
    return 'Topic pivot and nextUpdateDate must be whole numbers'
  }
  return (
    timeProblem('Topic updatedAt', topic.updatedAt) ??
    timeProblem('Topic deletedAt', topic.deletedAt)
  )
}

function cardProblem(card: CardRecord): string | null {
  if (!isParseableJson(card.dataJson) || hasNul(card.dataJson)) {
    return 'Card dataJson is not storable JSON'
  }
  if (
    !Number.isInteger(card.level) ||
    card.level < INT32_MIN ||
    card.level > INT32_MAX
  ) {
    return 'Card level must be a 32-bit integer'
  }
  if (card.reviewDate != null && !isBigIntSafe(card.reviewDate)) {
    return 'Card reviewDate must be a whole number'
  }
  return (
    timeProblem('Card updatedAt', card.updatedAt) ??
    timeProblem('Card deletedAt', card.deletedAt)
  )
}

function upsertProblem(mutation: Mutation): string | null {
  if (mutation.table === 'topics') {
    const { topic } = mutation
    if (!topic) return 'Topic upsert missing payload'
    if (topic.id !== mutation.recordId) {
      return 'Topic payload id does not match recordId'
    }
    return topicProblem(topic)
  }
  const { card } = mutation
  if (!card) return 'Card upsert missing payload'
  if (card.id !== mutation.recordId) {
    return 'Card payload id does not match recordId'
  }
  return cardProblem(card)
}

/** First reason `mutation` can never be applied, or null when it is well formed. */
export function mutationProblem(mutation: Mutation): string | null {
  return (
    timeProblem('updatedAt', mutation.updatedAt) ??
    (mutation.operation === 'upsert' ? upsertProblem(mutation) : null)
  )
}

/** Splits a batch into appliable mutations and permanent rejections. */
export function partitionMalformed(mutations: Mutation[]): {
  valid: Mutation[]
  rejected: RejectedOp[]
} {
  const valid: Mutation[] = []
  const rejected: RejectedOp[] = []
  for (const mutation of mutations) {
    const problem = mutationProblem(mutation)
    if (problem === null) {
      valid.push(mutation)
    } else {
      rejected.push({
        opId: mutation.opId,
        code: 'VALIDATION_ERROR',
        message: problem,
        retryable: false
      })
    }
  }
  return { valid, rejected }
}
