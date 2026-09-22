import { readList, writeList } from '../lib/chrome-store'
import { TOPICS_KEY } from '../lib/keys'
import type { Topic } from '../types'

const TOPIC_TITLE = 'Anonymus Topic'

export const getTopics = () => readList<Topic>(TOPICS_KEY)

export async function setTopics(topics: Topic[]): Promise<void> {
  await writeList(TOPICS_KEY, topics)
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
