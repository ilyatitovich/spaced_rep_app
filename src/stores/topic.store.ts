import { create } from 'zustand'

import type { Topic } from '../lib/definitions'

type TopicState = {
  topic: Topic | null
  setTopic: (topic: Topic) => void
  clearTopic: () => void
}

export const useTopicStore = create<TopicState>(set => ({
  topic: null,
  setTopic: topic => set({ topic }),
  clearTopic: () => set({ topic: null })
}))
