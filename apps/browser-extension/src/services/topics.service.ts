import { TITLE_MAX_LENGTH } from '@/lib/constants'
import { createTopic as buildTopic, type Topic } from '@/models/topic.model'
import { readList, readValue, writeList, writeValue } from '../lib/chrome-store'
import { PAGE_TOPICS_KEY, SELECTED_TOPIC_KEY, TOPICS_KEY } from '../lib/keys'
import { enqueue } from './outbox.service'

export const getTopics = () => readList<Topic>(TOPICS_KEY)

export function topicTitleForPage(title: string): string {
  return title.trim().slice(0, TITLE_MAX_LENGTH) || 'Web clips'
}

export function mergeTopics(...lists: Topic[][]): Topic[] {
  return [...new Map(lists.flat().map(topic => [topic.id, topic])).values()]
}

export async function setTopics(topics: Topic[]): Promise<void> {
  await writeList(TOPICS_KEY, mergeTopics(topics))
}

export async function getSelectedTopicId(): Promise<string | undefined> {
  const stored = await readValue(SELECTED_TOPIC_KEY)
  return typeof stored === 'string' && stored ? stored : undefined
}

export async function setSelectedTopicId(id: string): Promise<void> {
  await writeValue(SELECTED_TOPIC_KEY, id)
}

export async function resolveSelectedTopicId(
  topics: Topic[],
  fallbackId?: string
): Promise<string> {
  const stored = await getSelectedTopicId()
  const ids = new Set(topics.map(topic => topic.id))
  if (stored && ids.has(stored)) return stored
  const next = fallbackId && ids.has(fallbackId) ? fallbackId : ''
  if (next) await setSelectedTopicId(next)
  return next
}

async function enqueueTopic(recordId: string, updatedAt: number) {
  await enqueue({
    id: crypto.randomUUID(),
    table: 'topics',
    recordId,
    operation: 'upsert',
    updatedAt,
    attempts: 0,
    nextAttemptAt: 0
  })
}

export async function createTopic(
  title: string,
  enqueueSync = false
): Promise<Topic> {
  const topic = buildTopic(topicTitleForPage(title))
  await setTopics([...(await getTopics()), topic])
  if (enqueueSync) await enqueueTopic(topic.id, topic.updatedAt)
  return topic
}

export async function renameTopic(
  id: string,
  title: string,
  enqueueSync = false
): Promise<Topic | undefined> {
  const nextTitle = title.trim().slice(0, TITLE_MAX_LENGTH)
  if (!nextTitle) return (await getTopics()).find(topic => topic.id === id)
  const topics = await getTopics()
  const index = topics.findIndex(topic => topic.id === id)
  const existing = topics[index]
  if (!existing) return undefined
  const topic = { ...existing, title: nextTitle, updatedAt: Date.now() }
  topics[index] = topic
  await setTopics(topics)
  if (enqueueSync) await enqueueTopic(topic.id, topic.updatedAt)
  return topic
}

function pageKey(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return url
  }
}

function asPageIndex(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, string>
}

export async function getTopicIdForPage(
  url: string
): Promise<string | undefined> {
  const id = asPageIndex(await readValue(PAGE_TOPICS_KEY))[pageKey(url)]
  if (!id) return undefined
  return (await getTopics()).some(topic => topic.id === id) ? id : undefined
}

export async function ensureTopicForPage(
  page: { title: string; url: string },
  enqueueSync = false
): Promise<Topic> {
  const key = pageKey(page.url)
  const index = asPageIndex(await readValue(PAGE_TOPICS_KEY))
  const existingId = index[key]
  const existing = existingId
    ? (await getTopics()).find(topic => topic.id === existingId)
    : undefined
  if (existing) {
    await setSelectedTopicId(existing.id)
    return existing
  }
  const topic = await createTopic(topicTitleForPage(page.title), enqueueSync)
  await writeValue(PAGE_TOPICS_KEY, { ...index, [key]: topic.id })
  await setSelectedTopicId(topic.id)
  return topic
}
