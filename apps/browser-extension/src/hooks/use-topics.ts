import { useCallback, useState } from 'react'

import { createTopic, type Topic } from '@/models/topic.model'
import { bootstrapTopics } from '../services/sync.service'
import {
  ensureLocalTopic,
  getTopics,
  setTopics as persistTopics
} from '../services/topics.service'

export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [localTopicId, setLocalTopicId] = useState('')

  const refresh = useCallback(async (isPro: boolean) => {
    const loaded = isPro ? await bootstrapTopics() : await getTopics()
    const local = await ensureLocalTopic()
    setLocalTopicId(local.id)
    if (!isPro || loaded.length === 0) loaded.push(local)
    setTopics(loaded)
    setSelectedId(loaded[0]?.id ?? local.id)
    return loaded
  }, [])

  const create = useCallback(async (title: string) => {
    const topic = createTopic(title)
    const next = [...(await getTopics()), topic]
    await persistTopics(next)
    setTopics(next)
    setSelectedId(topic.id)
    return topic
  }, [])

  return {
    topics,
    selectedId,
    localTopicId,
    select: setSelectedId,
    create,
    refresh
  }
}
