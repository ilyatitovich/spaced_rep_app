import { create } from 'zustand'

import { Topic } from '@/models'
import { getTopicById, deleteTopic } from '@/services'

type TopicState = {
  currentTopic: Topic | null
  loading: boolean
  error: string | null

  fetchTopic: (id: string) => Promise<void>
  clearCurrent: () => void
  deleteTopicById: (id: string) => Promise<void>
}

export const useTopicStore = create<TopicState>((set, get) => ({
  currentTopic: null,
  topicCards: [],
  loading: false,
  error: null,

  fetchTopic: async (id: string) => {
    set({ loading: true, error: null })

    try {
      let topic = await getTopicById(id)
      if (!topic) throw new Error('Topic not found')

      set({
        currentTopic: topic,
        loading: false,
        error: null
      })
    } catch (err) {
      console.error('Failed to load topic', err)
      set({
        currentTopic: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  },

  clearCurrent: () => {
    if (!get().currentTopic) return
    set({ currentTopic: null })
  },

  deleteTopicById: async (id: string) => {
    try {
      await deleteTopic(id)
    } catch (error) {
      console.error('Error deleting topic:', error)
      throw error
    }
  }
}))
