import { useCallback, useRef, useState } from 'react'

import { TITLE_MAX_LENGTH } from '@/lib/constants'
import type { Topic } from '@/models/topic.model'
import { bootstrapTopics } from '../services/sync.service'
import {
  createTopic,
  getTopicIdForPage,
  getTopics,
  renameTopic,
  resolveSelectedTopicId,
  setSelectedTopicId
} from '../services/topics.service'

export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [pendingTitle, setPendingTitle] = useState('')
  const isProRef = useRef(false)
  const pageUrlRef = useRef('')

  const refresh = useCallback(async (isPro: boolean) => {
    isProRef.current = isPro
    const next = isPro ? await bootstrapTopics() : await getTopics()
    const mapped = pageUrlRef.current
      ? await getTopicIdForPage(pageUrlRef.current)
      : undefined
    setTopics(next)
    setSelectedId(await resolveSelectedTopicId(next, mapped))
    return next
  }, [])

  const select = useCallback((id: string) => {
    setSelectedId(id)
    void setSelectedTopicId(id)
  }, [])

  const syncPage = useCallback(
    async (page: { title: string; url: string }) => {
      if (!page.url) return
      const previous = pageUrlRef.current
      pageUrlRef.current = page.url
      const mapped = await getTopicIdForPage(page.url)
      if (!previous) {
        setSelectedId(
          await resolveSelectedTopicId(await getTopics(), mapped)
        )
        return
      }
      if (previous === page.url) return
      if (mapped) select(mapped)
      else {
        setSelectedId('')
        setPendingTitle('')
      }
    },
    [select]
  )

  const create = useCallback(
    async (title: string) => {
      const topic = await createTopic(title, isProRef.current)
      setTopics(await getTopics())
      select(topic.id)
      return topic
    },
    [select]
  )

  const rename = useCallback(
    async (title: string) => {
      const next = title.trim().slice(0, TITLE_MAX_LENGTH)
      if (!next) return
      if (!selectedId) {
        setPendingTitle(next)
        return
      }
      const topic = await renameTopic(selectedId, next, isProRef.current)
      if (topic) setTopics(await getTopics())
    },
    [selectedId]
  )

  return {
    topics,
    selectedId,
    pendingTitle,
    select,
    create,
    rename,
    refresh,
    syncPage
  }
}
