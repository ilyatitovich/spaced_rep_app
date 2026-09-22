import { createTopic, type Topic } from '@/models/topic.model'
import { readList, writeList } from '../lib/chrome-store'
import { TOPICS_KEY } from '../lib/keys'

const TOPIC_TITLE = 'Anonymus Topic'

export const getTopics = () => readList<Topic>(TOPICS_KEY)

export async function setTopics(topics: Topic[]): Promise<void> {
  await writeList(TOPICS_KEY, topics)
}

export async function ensureLocalTopic(): Promise<Topic> {
  const topics = await getTopics()
  const existing = topics.find(topic => topic.title === TOPIC_TITLE)
  if (existing) return existing
  const topic = createTopic(TOPIC_TITLE)
  await setTopics([...topics, topic])
  return topic
}
