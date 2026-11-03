import { promisifyRequest } from '@/lib'
import { STORES, withTransaction } from '@/lib/db'
import type { Card, Topic } from '@/models'

/**
 * Runtime lookup for topics and cards. IndexedDB is only the durable cache.
 *
 * Isolation: topics are structured-cloned and cards shallow-cloned on write, and
 * topics are cloned on read, so callers can mutate what they hold without touching
 * live state. That keeps the `previous` value returned by put/delete intact for
 * rollback. Card reads return live references: treat them as read-only.
 */
let topics = new Map<string, Topic>()
let cards = new Map<string, Card>()
let cardsByTopic = new Map<string, Map<string, Card>>()
const listeners = new Set<() => void>()

function indexCard(card: Card): void {
  let bucket = cardsByTopic.get(card.topicId)
  if (!bucket) {
    bucket = new Map()
    cardsByTopic.set(card.topicId, bucket)
  }
  bucket.set(card.id, card)
}

function unindexCard(card: Card): void {
  const bucket = cardsByTopic.get(card.topicId)
  if (!bucket) return
  bucket.delete(card.id)
  if (bucket.size === 0) cardsByTopic.delete(card.topicId)
}

function setCard(card: Card): Card | undefined {
  const previous = cards.get(card.id)
  if (previous) unindexCard(previous)
  cards.set(card.id, card)
  indexCard(card)
  return previous
}

function removeCard(id: string): Card | undefined {
  const previous = cards.get(id)
  if (previous) {
    cards.delete(id)
    unindexCard(previous)
  }
  return previous
}

function replaceAll(nextTopics: Topic[], nextCards: Card[]): void {
  topics = new Map(nextTopics.map(topic => [topic.id, topic]))
  cards = new Map()
  cardsByTopic = new Map()
  for (const card of nextCards) setCard(card)
}

export function emitStudyData(): void {
  listeners.forEach(listener => listener())
}

export function subscribeStudyData(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Load IndexedDB into memory. Throws on failure and leaves memory untouched. */
export async function hydrateStudyMemory(): Promise<void> {
  const [loadedTopics, loadedCards] = await withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readonly',
    async stores =>
      Promise.all([
        promisifyRequest(stores[STORES.TOPICS].getAll() as IDBRequest<Topic[]>),
        promisifyRequest(stores[STORES.CARDS].getAll() as IDBRequest<Card[]>)
      ])
  )
  replaceAll(loadedTopics, loadedCards)
  emitStudyData()
}

export function getTopicFromMemory(id: string): Topic | undefined {
  const topic = topics.get(id)
  return topic ? structuredClone(topic) : undefined
}

export function getAllTopicsFromMemory(): Topic[] {
  return [...topics.values()].map(topic => structuredClone(topic))
}

export function findTopicByTitle(title: string): Topic | undefined {
  for (const topic of topics.values()) {
    if (topic.title === title) return structuredClone(topic)
  }
  return undefined
}

export function getCardFromMemory(id: string): Card | undefined {
  return cards.get(id)
}

export function getAllCardsFromMemory(): Card[] {
  return [...cards.values()]
}

export function getCardsByTopicFromMemory(topicId: string): Card[] {
  return [...(cardsByTopic.get(topicId)?.values() ?? [])]
}

export function getCardsByTopicAndLevelFromMemory(
  topicId: string,
  level: number
): Card[] {
  return getCardsByTopicFromMemory(topicId).filter(card => card.level === level)
}

/** Stores an isolated copy. Returns the previous value (undefined if new). */
export function putTopicInMemory(topic: Topic): Topic | undefined {
  const previous = topics.get(topic.id)
  topics.set(topic.id, structuredClone(topic))
  return previous
}

/** Returns the removed value. */
export function deleteTopicFromMemory(id: string): Topic | undefined {
  const previous = topics.get(id)
  topics.delete(id)
  return previous
}

/** Stores an isolated copy. Returns the previous value (undefined if new). */
export function putCardInMemory(card: Card): Card | undefined {
  return setCard({ ...card })
}

/** Returns the removed value. */
export function deleteCardFromMemory(id: string): Card | undefined {
  return removeCard(id)
}

export function restoreTopicInMemory(
  id: string,
  previous: Topic | undefined
): void {
  if (previous === undefined) topics.delete(id)
  else topics.set(id, previous)
}

export function restoreCardInMemory(
  id: string,
  previous: Card | undefined
): void {
  if (previous === undefined) removeCard(id)
  else setCard(previous)
}

export function clearStudyMemory(): void {
  replaceAll([], [])
}

export function __resetStudyMemoryForTests(): void {
  clearStudyMemory()
  listeners.clear()
}
