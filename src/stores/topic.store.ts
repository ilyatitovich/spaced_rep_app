import { create } from 'zustand'

import { Topic, Card, type TopicPlain } from '@/models'
import {
  createCard,
  createTopic,
  deleteTopic,
  getAllTopics,
  getTopicById,
  updateCard,
  updateTopic
} from '@/services'

type CardsMap = Record<number, Card[]>

type TopicStore = {
  isLoading: boolean

  allTopics: Array<Topic | TopicPlain>
  fetchAllTopics: () => Promise<void>

  topic: TopicPlain | null
  fetchTopic: (topicId: string) => Promise<void>
  addNewTopic: (topic: Topic) => Promise<void>
  updateTopic: (topic: TopicPlain) => Promise<void>
  deleteTopic: (topicId: string) => Promise<void>

  cards: CardsMap
  setCards: (fn: (prev: CardsMap) => CardsMap) => void
  addCard: (card: Card) => Promise<void>
  editCard: Card | null
  setEditCard: (cardId: string) => void
  updateCard: (card: Card) => Promise<void>
  moveCardToLevel: (card: Card, levelId: number) => Promise<void>

  level: number | undefined
  setLevel: (level: number) => void
}

export const useTopicStore = create<TopicStore>((set, get) => ({
  isLoading: true,

  allTopics: [],
  fetchAllTopics: async () => {
    try {
      const topics = await getAllTopics()
      set({
        allTopics: topics.sort((a, b) => b.pivot - a.pivot)
      })
    } catch (err) {
      console.error('Failed to load topics:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  topic: null,
  fetchTopic: async (topicId: string) => {
    try {
      const { topic, cards } = await getTopicById(topicId)
      set({ topic, cards })
    } catch (err) {
      console.error('Failed to fetch topic:', err)
    }
  },

  addNewTopic: async (topic: Topic) => {
    await createTopic(topic)
    set({
      allTopics: [topic, ...get().allTopics]
    })
  },
  updateTopic: async (topic: TopicPlain) => {
    await updateTopic(topic)
    set({
      topic: { ...topic },
      allTopics: get().allTopics.map(t => (t.id === topic.id ? topic : t))
    })
  },
  deleteTopic: async (topicId: string) => {
    await deleteTopic(topicId)
    set({
      topic: null,
      allTopics: get().allTopics.filter(t => t.id !== topicId)
    })
  },

  cards: {},
  editCard: null,
  setCards: fn => {
    set(state => ({ cards: fn(state.cards) }))
  },
  addCard: async card => {
    try {
      await createCard(card)
      set(state => {
        const levelCards = state.cards[card.level] ?? []
        return {
          cards: { ...state.cards, [card.level]: [...levelCards, card] }
        }
      })
    } catch (err) {
      console.error('Failed to crate card:', err)
    }
  },
  setEditCard: cardId => {
    set(state => ({
      editCard:
        state.level !== undefined
          ? state.cards[state.level].find(card => card.id === cardId)
          : null
    }))
  },

  updateCard: async card => {
    try {
      await updateCard(card)
      set(state => {
        if (state.level === 0 && card.level === 1) {
          return {
            editCard: card,
            cards: {
              ...state.cards,
              [0]: state.cards[0].filter(c => c.id !== card.id),
              [1]: [...(state.cards[1] || []), card]
            }
          }
        }

        return {
          editCard: card,
          cards: {
            [card.level]: state.cards[card.level].map(c =>
              c.id === card.id ? card : c
            )
          }
        }
      })
    } catch (err) {
      console.error(`Failde to update card with id: ${card.id}:`, err)
    }
  },

  moveCardToLevel: async (card, prevLevel) => {
    try {
      await updateCard(card)
      const newLevel = card.level
      set(state => ({
        cards: {
          ...state.cards,
          [prevLevel]: state.cards[prevLevel].filter(c => c.id !== card.id),
          [newLevel]: [...(state.cards[newLevel] || []), card]
        }
      }))
    } catch (err) {
      console.error(
        `Failde to move card with id ${card.id} from level ${prevLevel} to ${card.level}:`,
        err
      )
    }
  },

  level: undefined,
  setLevel: levelId => {
    set({ level: levelId })
  }
}))
