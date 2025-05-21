import { TopicItem } from '../../lib/definitions'
import { getTopicsList } from '../../lib/utils'

export async function homeLoader(): Promise<{ topics: TopicItem[] }> {
  return { topics: getTopicsList() }
}
