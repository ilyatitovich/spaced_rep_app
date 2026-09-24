import { searchTopics } from '@/lib'
import { Topic } from '@/models'
import {
  archiveTopics as persistArchiveTopics,
  deleteTopic,
  getAllTopics,
  subscribeSyncData,
  unarchiveTopics as persistUnarchiveTopics,
  updateTopic
} from '@/services'
import { create } from 'zustand'

const applyFilters = (allTopics: Topic[], searchQuery: string) => ({
  allTopics,
  topics: searchTopics(
    allTopics.filter(t => !t.isArchived),
    searchQuery
  ),
  archivedTopics: allTopics.filter(t => t.isArchived)
})

type TopicsStore = {
  isLoading: boolean
  topics: Topic[]
  archivedTopics: Topic[]
  currentTopic: Topic | null
  allTopics: Topic[]
  searchQuery: string
  loadTopics: () => Promise<void>
  refreshTopics: () => Promise<void>
  addTopic: (topic: Topic) => void
  updateTopic: (topic: Topic) => Promise<void>
  deleteTopics: (ids: string | string[]) => Promise<void>
  archiveTopics: (ids: string | string[]) => Promise<void>
  unarchiveTopics: (ids: string | string[]) => Promise<void>
  searchTopics: (query: string) => void
  setCurrentTopic: (topic: Topic) => void
}

export const useTopicsStore = create<TopicsStore>((set, get) => ({
  topics: [],
  archivedTopics: [],
  currentTopic: null,
  allTopics: [],
  isLoading: false,
  searchQuery: '',
  loadTopics: async () => {
    try {
      set({ isLoading: true })
      const allTopics = await getAllTopics()
      set({
        ...applyFilters(allTopics, get().searchQuery),
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
      set(state => applyFilters(allTopics, state.searchQuery))
    } catch (error) {
      console.error('Failed to refresh topics:', error)
    }
  },
  addTopic: (topic: Topic) =>
    set(state =>
      applyFilters([topic, ...state.allTopics], state.searchQuery)
    ),
  updateTopic: async (topic: Topic) => {
    await updateTopic(topic)
    set(state =>
      applyFilters(
        state.allTopics.map(t => (t.id === topic.id ? topic : t)),
        state.searchQuery
      )
    )
  },
  deleteTopics: async (ids: string | string[]) => {
    const idList = Array.isArray(ids) ? ids : [ids]
    await Promise.all(idList.map(id => deleteTopic(id)))
    set(state =>
      applyFilters(
        state.allTopics.filter(topic => !idList.includes(topic.id)),
        state.searchQuery
      )
    )
  },
  archiveTopics: async (ids: string | string[]) => {
    const idList = Array.isArray(ids) ? ids : [ids]
    const idSet = new Set(idList)
    const toArchive = get().allTopics.filter(t => idSet.has(t.id))
    if (toArchive.length === 0) return
    await persistArchiveTopics(toArchive)
    set(state => applyFilters(state.allTopics, state.searchQuery))
  },
  unarchiveTopics: async (ids: string | string[]) => {
    const idList = Array.isArray(ids) ? ids : [ids]
    const idSet = new Set(idList)
    const toUnarchive = get().allTopics.filter(t => idSet.has(t.id))
    if (toUnarchive.length === 0) return
    await persistUnarchiveTopics(toUnarchive)
    set(state => applyFilters(state.allTopics, state.searchQuery))
  },
  searchTopics: (query: string) =>
    set(state => ({
      searchQuery: query,
      ...applyFilters(state.allTopics, query)
    })),
  setCurrentTopic: (topic: Topic) => set({ currentTopic: topic })
}))

// Reactive bridge: when the sync layer writes remote changes into the local DB,
// pull the fresh data into the store so subscribed components re-render.
subscribeSyncData(() => {
  void useTopicsStore.getState().refreshTopics()
})
