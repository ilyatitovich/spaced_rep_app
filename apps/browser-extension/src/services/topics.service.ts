import { createTopic, type Topic } from '@/models/topic.model'
import { readList, readValue, writeList, writeValue } from '../lib/chrome-store'
import { SELECTED_TOPIC_KEY, TOPICS_KEY } from '../lib/keys'

const TOPIC_TITLE = 'Anonymus Topic'

export const getTopics = () => readList<Topic>(TOPICS_KEY)

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
  const next =
    (fallbackId && ids.has(fallbackId) ? fallbackId : topics[0]?.id) ?? ''
  if (next) await setSelectedTopicId(next)
  return next
}

export async function ensureLocalTopic(): Promise<Topic> {
  const topics = await getTopics()
  const selectedId = await getSelectedTopicId()
  const existing = topics.find(topic => topic.id === selectedId) ?? topics[0]
  if (existing) return existing
  const topic = createTopic(TOPIC_TITLE)
  await setTopics([topic])
  return topic
}
