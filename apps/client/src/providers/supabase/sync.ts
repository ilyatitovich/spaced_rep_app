import type {
  CardRecord,
  Mutation,
  PullDelta,
  PushAck,
  SyncRecord,
  TopicConflictResolved,
  TopicRecord
} from '@spaced-rep/sync-protocol'
import { ApiError } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { SyncPort } from '../types'
import type { AuthPort } from '../types'

type TopicRow = {
  id: string
  user_id: string
  title: string
  pivot: number
  week: unknown
  next_update_date: number
  updated_at: string
  deleted_at: string | null
}

type CardRow = {
  id: string
  user_id: string
  topic_id: string
  level: number
  data: unknown
  review_date: number | null
  updated_at: string
  deleted_at: string | null
}

async function requireUserId(auth: AuthPort): Promise<string> {
  const user = await auth.getCurrentUser()
  if (!user) throw new ApiError(401, 'Not authenticated', 'UNAUTHORIZED')
  return user.id
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString()
}

function isoToMs(iso: string): number {
  return new Date(iso).getTime()
}

function topicRecordToRow(record: TopicRecord, userId: string): TopicRow {
  return {
    id: record.id,
    user_id: userId,
    title: record.title,
    pivot: record.pivot,
    week: JSON.parse(record.weekJson),
    next_update_date: record.nextUpdateDate,
    updated_at: msToIso(record.updatedAt),
    deleted_at:
      record.deletedAt != null ? msToIso(record.deletedAt) : null
  }
}

function cardRecordToRow(record: CardRecord, userId: string): CardRow {
  return {
    id: record.id,
    user_id: userId,
    topic_id: record.topicId,
    level: record.level,
    data: JSON.parse(record.dataJson),
    review_date: record.reviewDate ?? null,
    updated_at: msToIso(record.updatedAt),
    deleted_at:
      record.deletedAt != null ? msToIso(record.deletedAt) : null
  }
}

function rowToTopicRecord(row: TopicRow): TopicRecord {
  return {
    id: row.id,
    title: row.title,
    pivot: Number(row.pivot),
    weekJson: JSON.stringify(row.week),
    nextUpdateDate: Number(row.next_update_date),
    updatedAt: isoToMs(row.updated_at),
    deletedAt: row.deleted_at ? isoToMs(row.deleted_at) : null
  }
}

function rowToCardRecord(row: CardRow): CardRecord {
  return {
    id: row.id,
    topicId: row.topic_id,
    level: row.level,
    dataJson: JSON.stringify(row.data),
    reviewDate: row.review_date,
    updatedAt: isoToMs(row.updated_at),
    deletedAt: row.deleted_at ? isoToMs(row.deleted_at) : null
  }
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '23505' ||
    (error.message?.includes('topics_user_title_unique') ?? false)
  )
}

async function resolveTitleConflict(
  userId: string,
  topicId: string,
  title: string,
  updatedAt: number
): Promise<TopicConflictResolved> {
  const shortId = topicId.slice(0, 8)
  const newTitle = `${title} (${shortId})`
  const { error } = await supabase
    .from('topics')
    .update({ title: newTitle, updated_at: msToIso(updatedAt) })
    .eq('id', topicId)
    .eq('user_id', userId)

  if (error) throw new ApiError(500, error.message)

  return {
    topicId,
    oldTitle: title,
    newTitle,
    reason: 'duplicate_title',
    updatedAt
  }
}

async function applyTopicUpsert(
  userId: string,
  mutation: Mutation
): Promise<{ conflict?: TopicConflictResolved }> {
  if (!mutation.topic) {
    throw new ApiError(400, 'Missing topic payload')
  }

  const { data: existing } = await supabase
    .from('topics')
    .select('updated_at')
    .eq('id', mutation.recordId)
    .maybeSingle()

  if (
    existing &&
    isoToMs(existing.updated_at as string) > mutation.updatedAt
  ) {
    return {}
  }

  const row = topicRecordToRow(mutation.topic, userId)
  const { error } = await supabase.from('topics').upsert(row)

  if (error && isUniqueViolation(error)) {
    const conflict = await resolveTitleConflict(
      userId,
      mutation.topic.id,
      mutation.topic.title,
      mutation.updatedAt
    )
    const renamed = {
      ...row,
      title: conflict.newTitle
    }
    const { error: retryError } = await supabase.from('topics').upsert(renamed)
    if (retryError) throw new ApiError(500, retryError.message)
    return { conflict }
  }

  if (error) throw new ApiError(500, error.message)
  return {}
}

async function applyCardUpsert(userId: string, mutation: Mutation): Promise<void> {
  if (!mutation.card) {
    throw new ApiError(400, 'Missing card payload')
  }

  const { data: existing } = await supabase
    .from('cards')
    .select('updated_at')
    .eq('id', mutation.recordId)
    .maybeSingle()

  if (
    existing &&
    isoToMs(existing.updated_at as string) > mutation.updatedAt
  ) {
    return
  }

  const row = cardRecordToRow(mutation.card, userId)
  const { error } = await supabase.from('cards').upsert(row)
  if (error) throw new ApiError(500, error.message)
}

async function applyDelete(
  table: 'topics' | 'cards',
  userId: string,
  recordId: string,
  updatedAt: number
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({
      deleted_at: msToIso(updatedAt),
      updated_at: msToIso(updatedAt)
    })
    .eq('id', recordId)
    .eq('user_id', userId)

  if (error) throw new ApiError(500, error.message)
}

async function touchDevice(
  userId: string,
  deviceId: string,
  lastPulledAt?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    id: deviceId,
    user_id: userId,
    last_seen_at: new Date().toISOString(),
    user_agent:
      typeof navigator !== 'undefined' ? navigator.userAgent : null
  }
  if (lastPulledAt) payload.last_pulled_at = lastPulledAt

  const { error } = await supabase.from('sync_devices').upsert(payload)
  if (error) throw new ApiError(500, error.message)
}

async function pullSince(userId: string, since: string): Promise<PullDelta> {
  const [{ data: topics, error: topicsError }, { data: cards, error: cardsError }] =
    await Promise.all([
      supabase
        .from('topics')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', since)
        .order('updated_at', { ascending: true }),
      supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
    ])

  if (topicsError) throw new ApiError(500, topicsError.message)
  if (cardsError) throw new ApiError(500, cardsError.message)

  const records: SyncRecord[] = [
    ...((topics ?? []) as TopicRow[]).map(row => ({
      topic: rowToTopicRecord(row)
    })),
    ...((cards ?? []) as CardRow[]).map(row => ({
      card: rowToCardRecord(row)
    }))
  ]

  let maxUpdated = since
  for (const row of [...(topics ?? []), ...(cards ?? [])] as Array<{
    updated_at: string
  }>) {
    if (row.updated_at > maxUpdated) maxUpdated = row.updated_at
  }

  return {
    records,
    watermark: maxUpdated,
    more: false
  }
}

export function createSupabaseSyncAdapter(auth: AuthPort): SyncPort {
  return {
    async push({ deviceId, mutations }) {
      const userId = await requireUserId(auth)
      const acceptedOpIds: string[] = []
      const rejected: PushAck['rejected'] = []
      const conflicts: TopicConflictResolved[] = []

      for (const mutation of mutations) {
        try {
          if (mutation.operation === 'delete') {
            await applyDelete(
              mutation.table,
              userId,
              mutation.recordId,
              mutation.updatedAt
            )
          } else if (mutation.table === 'topics') {
            const result = await applyTopicUpsert(userId, mutation)
            if (result.conflict) conflicts.push(result.conflict)
          } else {
            await applyCardUpsert(userId, mutation)
          }

          await supabase.from('sync_operations').upsert(
            {
              id: crypto.randomUUID(),
              user_id: userId,
              op_id: mutation.opId,
              device_id: deviceId,
              applied_at: new Date().toISOString()
            },
            { onConflict: 'user_id,op_id', ignoreDuplicates: true }
          )

          acceptedOpIds.push(mutation.opId)
        } catch (err) {
          rejected.push({
            opId: mutation.opId,
            code: 'PUSH_FAILED',
            message: err instanceof Error ? err.message : 'Push failed',
            retryable: true
          })
        }
      }

      await touchDevice(userId, deviceId)
      return { acceptedOpIds, rejected, conflicts }
    },

    async pull({ deviceId, since }) {
      const userId = await requireUserId(auth)
      const delta = await pullSince(userId, since)
      await touchDevice(userId, deviceId, delta.watermark)
      void supabase.rpc('purge_synced_tombstones')
      return delta
    },

    async bootstrap({ deviceId, lastPulledAt }) {
      const userId = await requireUserId(auth)
      const delta = await pullSince(userId, lastPulledAt)
      await touchDevice(userId, deviceId, delta.watermark)
      void supabase.rpc('purge_synced_tombstones')
      return delta
    }
  }
}
