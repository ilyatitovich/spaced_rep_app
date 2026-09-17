import type { Card, CardData, SideBlock, Topic } from '../types'
import {
  arrayBufferToBase64,
  base64ToArrayBuffer
} from '../../../client/src/lib/image'

const CARDS_KEY = 'cards'
const TOPICS_KEY = 'topics'
const OUTBOX_KEY = 'sync.outbox'
const TOPIC_TITLE = 'Browser Cards'

export type OutboxItem = {
  id: string
  cardId: string
  attempts: number
  nextAttemptAt: number
}

export function emptyCardData(): CardData {
  return {
    front: { side: 'front', blocks: [{ type: 'text', html: '' }] },
    back: { side: 'back', blocks: [{ type: 'text', html: '' }] }
  }
}

export function isBlockEmpty(block: SideBlock): boolean {
  if (block.type === 'text') {
    return !block.html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
  }
  if (block.type === 'code') return !block.code.trim()
  if ('src' in block.content) return !block.content.src.trim()
  return block.content.buffer.byteLength === 0
}

export function isSideEmpty(blocks: SideBlock[]): boolean {
  return blocks.every(isBlockEmpty)
}

export function appendBlocks(
  current: SideBlock[],
  incoming: SideBlock[]
): SideBlock[] {
  const last = current.at(-1)
  const base =
    last?.type === 'text' && isBlockEmpty(last) ? current.slice(0, -1) : current
  return [...base, ...incoming]
}

async function list<T>(key: string): Promise<T[]> {
  const stored = await chrome.storage.local.get(key)
  return Array.isArray(stored[key]) ? (stored[key] as T[]) : []
}

async function setList<T>(key: string, values: T[]): Promise<void> {
  await chrome.storage.local.set({ [key]: values })
}

export const getCards = () => list<Card>(CARDS_KEY)
export const getTopics = () => list<Topic>(TOPICS_KEY)
export const getOutbox = () => list<OutboxItem>(OUTBOX_KEY)

export async function getCard(id: string): Promise<Card | undefined> {
  return (await getCards()).find(card => card.id === id)
}

export async function setTopics(topics: Topic[]): Promise<void> {
  await setList(TOPICS_KEY, topics)
}

export async function ensureLocalTopic(): Promise<Topic> {
  const topics = await getTopics()
  const existing = topics.find(topic => topic.title === TOPIC_TITLE)
  if (existing) return existing
  const now = Date.now()
  const topic: Topic = {
    id: crypto.randomUUID(),
    title: TOPIC_TITLE,
    pivot: now,
    week: Array<null>(7).fill(null),
    nextUpdateDate: now + 7 * 86_400_000,
    updatedAt: now,
    deletedAt: null
  }
  await setTopics([...topics, topic])
  return topic
}

export async function saveCard(
  data: CardData,
  topicId: string,
  enqueueSync = false
): Promise<Card> {
  const card: Card = {
    id: crypto.randomUUID(),
    topicId,
    level:
      isSideEmpty(data.front.blocks) || isSideEmpty(data.back.blocks) ? 0 : 1,
    data: encodeCardData(data),
    updatedAt: Date.now()
  }
  await setList(CARDS_KEY, [...(await getCards()), card])
  if (enqueueSync) {
    await setList(OUTBOX_KEY, [
      ...(await getOutbox()),
      {
        id: crypto.randomUUID(),
        cardId: card.id,
        attempts: 0,
        nextAttemptAt: 0
      }
    ])
  }
  return card
}

export async function updateOutbox(item: OutboxItem): Promise<void> {
  const items = await getOutbox()
  await setList(
    OUTBOX_KEY,
    items.some(candidate => candidate.id === item.id)
      ? items.map(candidate => (candidate.id === item.id ? item : candidate))
      : [...items, item]
  )
}

export async function removeOutbox(id: string): Promise<void> {
  await setList(
    OUTBOX_KEY,
    (await getOutbox()).filter(item => item.id !== id)
  )
}

function encodeBlock(block: SideBlock): unknown {
  if (block.type === 'text' || block.type === 'code') return block
  if ('src' in block.content) return block
  return { ...block, content: arrayBufferToBase64(block.content) }
}

export function encodeCardData(data: CardData): unknown {
  return {
    front: { ...data.front, blocks: data.front.blocks.map(encodeBlock) },
    back: { ...data.back, blocks: data.back.blocks.map(encodeBlock) }
  }
}

export function decodeCardData(data: unknown): CardData {
  const value = data as CardData
  const decode = (block: SideBlock): SideBlock => {
    if (block.type === 'text' || block.type === 'code') return block
    if ('src' in block.content || block.content.buffer instanceof ArrayBuffer) {
      return block
    }
    return {
      ...block,
      content: base64ToArrayBuffer(
        block.content as unknown as { buffer: string; type: string }
      )
    }
  }
  return {
    front: { ...value.front, blocks: value.front.blocks.map(decode) },
    back: { ...value.back, blocks: value.back.blocks.map(decode) }
  }
}

export async function createBackup(): Promise<Blob> {
  const cards = await getCards()
  return new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          topics: await getTopics(),
          cards
        },
        null,
        2
      )
    ],
    { type: 'application/json' }
  )
}
