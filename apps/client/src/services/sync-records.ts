import type {
  CardRecord,
  MediaDBRecord,
  TopicRecord
} from '@spaced-rep/sync-protocol'
import { prepareWireCardData } from '@/lib/sync-media'
import { rowToCard, rowToTopic, type CardRow } from '@/lib/sync-serialize'
import type { Card, Topic } from '@/models'

export function topicToRecord(topic: Topic): TopicRecord {
  return {
    id: topic.id,
    title: topic.title,
    pivot: topic.pivot,
    weekJson: JSON.stringify(topic.week),
    nextUpdateDate: topic.nextUpdateDate,
    isArchived: topic.isArchived ?? false,
    updatedAt: topic.updatedAt ?? Date.now(),
    deletedAt: null
  }
}

export async function cardToWireRecord(card: Card): Promise<{
  record: CardRecord
  mediaByHash: Map<string, MediaDBRecord>
}> {
  const { wireData, mediaByHash } = await prepareWireCardData(card.data)
  return {
    record: {
      id: card.id,
      topicId: card.topicId,
      level: card.level,
      dataJson: JSON.stringify(wireData),
      reviewDate: card.reviewDate ?? null,
      updatedAt: card.updatedAt ?? Date.now(),
      deletedAt: null
    },
    mediaByHash
  }
}

export function recordToTopic(record: TopicRecord): Topic {
  return rowToTopic({
    id: record.id,
    user_id: '',
    title: record.title,
    pivot: record.pivot,
    week: JSON.parse(record.weekJson),
    next_update_date: record.nextUpdateDate,
    is_archived: record.isArchived ?? false,
    updated_at: new Date(record.updatedAt).toISOString(),
    deleted_at:
      record.deletedAt != null ? new Date(record.deletedAt).toISOString() : null
  })
}

export function recordToCard(record: CardRecord, data: CardRow['data']): Card {
  return rowToCard({
    id: record.id,
    user_id: '',
    topic_id: record.topicId,
    level: record.level,
    data,
    review_date: record.reviewDate ?? null,
    updated_at: new Date(record.updatedAt).toISOString(),
    deleted_at:
      record.deletedAt != null ? new Date(record.deletedAt).toISOString() : null
  })
}
