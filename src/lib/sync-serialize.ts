import { isRecord } from './check-content'
import { arrayBufferToBase64, base64ToArrayBuffer, isBase64Image } from './image'
import { Card, Topic } from '@/models'
import type { Day } from '@/models'
import type { CardData, CardSideData, ImageBase64Record, SideContent } from '@/types'

export type TopicRow = {
  id: string
  user_id: string
  title: string
  pivot: number
  week: Array<Day | null>
  next_update_date: number
  updated_at: string
  deleted_at: string | null
}

export type CardRow = {
  id: string
  user_id: string
  topic_id: string
  level: number
  data: CardData
  review_date: number | null
  updated_at: string
  deleted_at: string | null
}

function encodeSide(side: CardSideData): CardSideData {
  if (isRecord(side.content)) {
    const encoded = arrayBufferToBase64(side.content) as unknown as SideContent
    return { ...side, content: encoded }
  }
  return side
}

function decodeSide(side: CardSideData): CardSideData {
  if (isBase64Image(side.content)) {
    const record = side.content as unknown as ImageBase64Record
    return { ...side, content: base64ToArrayBuffer(record) }
  }
  return side
}

export function topicToRow(topic: Topic, userId: string): TopicRow {
  return {
    id: topic.id,
    user_id: userId,
    title: topic.title,
    pivot: topic.pivot,
    week: topic.week,
    next_update_date: topic.nextUpdateDate,
    updated_at: new Date(topic.updatedAt ?? Date.now()).toISOString(),
    deleted_at: null
  }
}

export function rowToTopic(row: TopicRow): Topic {
  const topic = new Topic(row.title)
  topic.id = row.id
  topic.pivot = row.pivot
  topic.week = row.week
  topic.nextUpdateDate = row.next_update_date
  topic.updatedAt = new Date(row.updated_at).getTime()
  return topic
}

export function cardToRow(card: Card, userId: string): CardRow {
  return {
    id: card.id,
    user_id: userId,
    topic_id: card.topicId,
    level: card.level,
    data: {
      front: encodeSide(card.data.front),
      back: encodeSide(card.data.back)
    },
    review_date: card.reviewDate ?? null,
    updated_at: new Date(card.updatedAt ?? Date.now()).toISOString(),
    deleted_at: null
  }
}

export function rowToCard(row: CardRow): Card {
  const data: CardData = {
    front: decodeSide(row.data.front),
    back: decodeSide(row.data.back)
  }
  const card = new Card(data, row.topic_id, row.level)
  card.id = row.id
  card.reviewDate = row.review_date ?? undefined
  card.updatedAt = new Date(row.updated_at).getTime()
  return card
}

export function shouldApplyRemote(
  localUpdatedAt: number | undefined,
  remoteUpdatedAt: number
): boolean {
  return localUpdatedAt === undefined || remoteUpdatedAt > localUpdatedAt
}
