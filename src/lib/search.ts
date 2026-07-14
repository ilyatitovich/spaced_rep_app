import { Topic } from '@/models'

export function searchTopics(topics: Topic[], query: string): Topic[] {
  const q = query.trim().toLowerCase()
  if (!q) return topics
  return topics.filter(topic => topic.title.toLowerCase().includes(q))
}
