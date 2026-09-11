import { isRecord } from './check-content'
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  isBase64Image
} from './image'
import { normalizeCardData } from './normalize-card'
import { Card, Topic } from '@/models'
import type { Day } from '@/models'
import type {
  CardData,
  CardSideData,
  ImageBase64Record,
  MediaDBRecord,
  LegacyCardData,
  LegacyCardSideData,
  SideBlock,
  SideContent
} from '@/types'

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
  data: LegacyCardData | CardData
  review_date: number | null
  updated_at: string
  deleted_at: string | null
}

type AnyCardSide = LegacyCardSideData | CardSideData
type AnyCardData = LegacyCardData | CardData

function isBlocksSide(side: AnyCardSide): side is CardSideData {
  return Array.isArray((side as CardSideData).blocks)
}

function encodeBlock(block: SideBlock): SideBlock {
  if (block.type === 'text' || block.type === 'code') return block
  if (!('buffer' in block.content)) return block
  return {
    ...block,
    content: arrayBufferToBase64(block.content) as unknown as MediaDBRecord
  }
}

function decodeBlock(block: SideBlock): SideBlock {
  if (block.type === 'text' || block.type === 'code') return block
  if (!('buffer' in block.content)) return block
  if (isBase64Image(block.content)) {
    return {
      ...block,
      content: base64ToArrayBuffer(
        block.content as unknown as ImageBase64Record
      )
    }
  }
  return block
}

export function encodeSide(side: AnyCardSide): AnyCardSide {
  if (isBlocksSide(side)) {
    return { side: side.side, blocks: side.blocks.map(encodeBlock) }
  }
  if (isRecord(side.content)) {
    return {
      ...side,
      content: arrayBufferToBase64(side.content) as unknown as SideContent
    }
  }
  return side
}

export function decodeSide(side: AnyCardSide): AnyCardSide {
  if (isBlocksSide(side)) {
    return { side: side.side, blocks: side.blocks.map(decodeBlock) }
  }
  if (isBase64Image(side.content)) {
    return {
      ...side,
      content: base64ToArrayBuffer(
        side.content as unknown as ImageBase64Record
      )
    }
  }
  return side
}

export function encodeCardData(data: AnyCardData): AnyCardData {
  return {
    front: encodeSide(data.front),
    back: encodeSide(data.back)
  } as AnyCardData
}

export function decodeCardData(data: AnyCardData): AnyCardData {
  return {
    front: decodeSide(data.front),
    back: decodeSide(data.back)
  } as AnyCardData
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
  return {
    id: row.id,
    title: row.title,
    pivot: row.pivot,
    week: row.week,
    nextUpdateDate: row.next_update_date,
    updatedAt: new Date(row.updated_at).getTime(),
    deletedAt: new Date(row.deleted_at ?? Date.now()).getTime() ?? null
  }
}

export function cardToRow(card: Card, userId: string): CardRow {
  return {
    id: card.id,
    user_id: userId,
    topic_id: card.topicId,
    level: card.level,
    data: encodeCardData(card.data),
    review_date: card.reviewDate ?? null,
    updated_at: new Date(card.updatedAt ?? Date.now()).toISOString(),
    deleted_at: null
  }
}

export function rowToCard(row: CardRow): Card {
  const data = normalizeCardData(decodeCardData(row.data))
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
