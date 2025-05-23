import { create } from 'zustand'

import type { Topic } from '@/lib/definitions'
import { updateWeek } from '@/lib/utils'
import { getTopicById, deleteTopic } from '@/services'

type TopicState = {
  currentTopic: Topic | null
  topics: Record<string, Topic>
  loading: boolean
  error: string | null

  fetchTopic: (id: string) => Promise<void>
  clearCurrent: () => void
  deleteTopicById: (id: string) => Promise<void>
}

export const useTopicStore = create<TopicState>((set, get) => ({
  currentTopic: null,
  topics: {},
  loading: false,
  error: null,

  fetchTopic: async (id: string) => {
    const cached = get().topics[id]

    if (cached) {
      set({ currentTopic: cached, loading: false, error: null })
      return
    }

    set({ loading: true, error: null })

    try {
      let topic = await getTopicById(id)
      if (!topic) throw new Error('Topic not found')

      // Temp: update week if update day has passed
      if (topic.nextUpdateDate <= Date.now()) {
        topic = updateWeek(topic)
      }
      //===========

      set(state => ({
        currentTopic: topic,
        topics: { ...state.topics, [id]: topic },
        loading: false,
        error: null
      }))
    } catch (err) {
      console.error('Failed to load topic', err)
      set({
        currentTopic: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  },

  clearCurrent: () => set({ currentTopic: null }),

  deleteTopicById: async (id: string) => {
    try {
      await deleteTopic(id)
      const { currentTopic } = get()

      set(state => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _, ...rest } = state.topics
        return {
          topics: rest,
          currentTopic: currentTopic?.id === id ? null : currentTopic
        }
      })
    } catch (error) {
      console.error('Error deleting topic:', error)
      throw error
    }
  }
}))
