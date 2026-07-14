import { searchTopics } from '@/lib'
import { Topic } from '@/models'
import {
  deleteTopic,
  getAllTopics,
  subscribeSyncData,
  updateTopic
} from '@/services'
import { create } from 'zustand'

type TopicsStore = {
  isLoading: boolean
  topics: Topic[]
  currentTopic: Topic | null
  allTopics: Topic[]
  searchQuery: string
  loadTopics: () => Promise<void>
  refreshTopics: () => Promise<void>
  addTopic: (topic: Topic) => void
  updateTopic: (topic: Topic) => Promise<void>
  deleteTopics: (ids: string | string[]) => Promise<void>
  searchTopics: (query: string) => void
  setCurrentTopic: (topic: Topic) => void
}

export const useTopicsStore = create<TopicsStore>((set, get) => ({
  topics: [],
  currentTopic: null,
  allTopics: [],
  isLoading: false,
  searchQuery: '',
  loadTopics: async () => {
    try {
      set({ isLoading: true })
      const allTopics = await getAllTopics()
      set({
        allTopics,
        topics: searchTopics(allTopics, get().searchQuery),
        isLoading: false
      })
    } catch (error) {
      console.error('Failed to load topics:', error)
      set({ isLoading: false })
    }
  },
  refreshTopics: async () => {
    try {
      const allTopics = await getAllTopics()
      set(state => ({
        allTopics,
        topics: searchTopics(allTopics, state.searchQuery)
      }))
    } catch (error) {
      console.error('Failed to refresh topics:', error)
    }
  },
  addTopic: (topic: Topic) =>
    set(state => {
      const allTopics = [topic, ...state.allTopics]
      return { allTopics, topics: searchTopics(allTopics, state.searchQuery) }
    }),
  updateTopic: async (topic: Topic) => {
    await updateTopic(topic)
    set(state => ({
      allTopics: state.allTopics.map(t => (t.id === topic.id ? topic : t)),
      topics: searchTopics(
        state.allTopics.map(t => (t.id === topic.id ? topic : t)),
        state.searchQuery
      )
    }))
  },
  deleteTopics: async (ids: string | string[]) => {
    await Promise.all(
      Array.isArray(ids) ? ids.map(id => deleteTopic(id)) : [deleteTopic(ids)]
    )
    set(state => ({
      allTopics: state.allTopics.filter(topic =>
        !Array.isArray(ids) ? ids.includes(topic.id) : !ids.includes(topic.id)
      ),
      topics: searchTopics(
        state.allTopics.filter(topic =>
          !Array.isArray(ids) ? ids.includes(topic.id) : !ids.includes(topic.id)
        ),
        state.searchQuery
      )
    }))
  },

  searchTopics: (query: string) =>
    set(state => ({
      searchQuery: query,
      topics: searchTopics(state.allTopics, query)
    })),
  setCurrentTopic: (topic: Topic) => set({ currentTopic: topic })
}))

// Reactive bridge: when the sync layer writes remote changes into the local DB,
// pull the fresh data into the store so subscribed components re-render.
subscribeSyncData(() => {
  void useTopicsStore.getState().refreshTopics()
})
