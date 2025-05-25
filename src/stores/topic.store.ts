import { create } from 'zustand'

import { Topic, Card } from '@/models'
import {
  getAllTopics,
  getTopicById,
  deleteTopic,
  updateTopic
} from '@/services'

type TopicState = {
  topics: Topic[]
  currentTopic: Topic | null
  loading: boolean
  error: string | null

  setTopic: (topic: Topic | null) => Promise<void>
  fetchAllTopics: () => Promise<void>
  fetchTopic: (id: string) => Promise<void>
  clearCurrent: () => void
  deleteTopicById: (id: string) => Promise<void>
  getLevelCards: (levelId: number) => Card[]
}

export const useTopicStore = create<TopicState>((set, get) => ({
  topics: [],
  currentTopic: null,
  loading: false,
  error: null,

  setTopic: async (topic: Topic | null) => {
    if (!topic) return

    try {
      await updateTopic(topic)
      set({ currentTopic: topic })
    } catch (error) {
      console.error('Error updating topic:', error)
    }
  },
  fetchAllTopics: async () => {
    set({ loading: true, error: null })
    try {
      const topics = await getAllTopics()
      set({
        topics: topics,
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Failed to load topics', error)
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

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
  },

  getLevelCards: (levelId: number) => {
    const topic = get().currentTopic
    if (!topic) return []

    return topic.levels[levelId].cards
  }
}))
