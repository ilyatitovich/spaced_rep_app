import type { CardRecord, TopicRecord } from '@spaced-rep/sync-protocol'
import type { Prisma } from '../generated/prisma/client.js'

export function topicRecordToDb(
  record: TopicRecord,
  userId: string
): Prisma.TopicUncheckedCreateInput {
  return {
    id: record.id,
    userId,
    title: record.title,
    pivot: BigInt(record.pivot),
    week: JSON.parse(record.weekJson) as Prisma.InputJsonValue,
    nextUpdateDate: BigInt(record.nextUpdateDate),
    updatedAt: new Date(record.updatedAt),
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : null
  }
}

export function dbTopicToRecord(row: {
  id: string
  title: string
  pivot: bigint
  week: unknown
  nextUpdateDate: bigint
  updatedAt: Date
  deletedAt: Date | null
}): TopicRecord {
  return {
    id: row.id,
    title: row.title,
    pivot: Number(row.pivot),
    weekJson: JSON.stringify(row.week ?? []),
    nextUpdateDate: Number(row.nextUpdateDate),
    updatedAt: row.updatedAt.getTime(),
    deletedAt: row.deletedAt?.getTime() ?? null
  }
}

export function cardRecordToDb(
  record: CardRecord,
  userId: string
): Prisma.CardUncheckedCreateInput {
  return {
    id: record.id,
    userId,
    topicId: record.topicId,
    level: record.level,
    data: JSON.parse(record.dataJson) as Prisma.InputJsonValue,
    reviewDate: record.reviewDate ? BigInt(record.reviewDate) : null,
    updatedAt: new Date(record.updatedAt),
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : null
  }
}

export function dbCardToRecord(row: {
  id: string
  topicId: string
  level: number
  data: unknown
  reviewDate: bigint | null
  updatedAt: Date
  deletedAt: Date | null
}): CardRecord {
  return {
    id: row.id,
    topicId: row.topicId,
    level: row.level,
    dataJson: JSON.stringify(row.data ?? {}),
    reviewDate: row.reviewDate != null ? Number(row.reviewDate) : null,
    updatedAt: row.updatedAt.getTime(),
    deletedAt: row.deletedAt?.getTime() ?? null
  }
}

/** LWW: remote wins only when strictly newer. Tie-break by deviceId then recordId. */
export function shouldApplyIncoming(
  existingUpdatedAt: number | undefined,
  existingDeviceId: string | undefined,
  existingRecordId: string | undefined,
  incomingUpdatedAt: number,
  incomingDeviceId: string,
  incomingRecordId: string
): boolean {
  if (existingUpdatedAt === undefined) return true
  if (incomingUpdatedAt > existingUpdatedAt) return true
  if (incomingUpdatedAt < existingUpdatedAt) return false
  const deviceCmp = incomingDeviceId.localeCompare(existingDeviceId ?? '')
  if (deviceCmp !== 0) return deviceCmp > 0
  return incomingRecordId.localeCompare(existingRecordId ?? '') > 0
}
