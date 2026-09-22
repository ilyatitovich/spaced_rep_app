import { useCallback, useState } from 'react'

import { createTopic, type Topic } from '@/models/topic.model'
import { bootstrapTopics } from '../services/sync.service'
import {
  ensureLocalTopic,
  getTopics,
  mergeTopics,
  resolveSelectedTopicId,
  setSelectedTopicId,
  setTopics as persistTopics
} from '../services/topics.service'

export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedId, setSelectedId] = useState('')

  const refresh = useCallback(async (isPro: boolean) => {
    const loaded = isPro ? await bootstrapTopics() : await getTopics()
    const local = await ensureLocalTopic()
    const next = mergeTopics(loaded, [local])
    setTopics(next)
    setSelectedId(await resolveSelectedTopicId(next, local.id))
    return next
  }, [])

  const select = useCallback((id: string) => {
    setSelectedId(id)
    void setSelectedTopicId(id)
  }, [])

  const create = useCallback(
    async (title: string) => {
      const topic = createTopic(title)
      const next = mergeTopics(await getTopics(), [topic])
      await persistTopics(next)
      setTopics(next)
      select(topic.id)
      return topic
    },
    [select]
  )

  return {
    topics,
    selectedId,
    select,
    create,
    refresh
  }
}
