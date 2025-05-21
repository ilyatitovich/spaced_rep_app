import type { LoaderFunctionArgs } from 'react-router'

import { getTopic, updateWeek } from '../../lib/utils'

export async function topicLoader({ params }: LoaderFunctionArgs) {
  let topic = getTopic(params.topicId!)
  const today: number = new Date().getDay()

  // update week if update day has passed
  if (topic.nextUpdateDate <= Date.now()) {
    topic = updateWeek(topic)
  }

  return { topic, today }
}
