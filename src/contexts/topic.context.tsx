import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction
} from 'react'

import { Topic, Card } from '@/models'
import { createTopic, getAllTopics, getTopicById } from '@/services'

type CardsMap = Record<number, Card[]>

type TopicContextType = {
  isLoading: boolean

  allTopics: Topic[]
  setAllTopics: Dispatch<SetStateAction<Topic[]>>
  fetchAllTopics: () => Promise<void>
  addNewTopic: (topic: Topic) => Promise<void>

  topic: Topic | null
  setTopic: (topic: Topic | null) => void
  fetchTopic: (topicId: string) => Promise<void>

  cards: Record<number, Card[]>
  setCards: Dispatch<SetStateAction<CardsMap>>

  updateCardsForTopic: (topicId: number, cards: Card[]) => void
  clearCardsForTopic: (topicId: number) => void
}

const TopicContext = createContext<TopicContextType | undefined>(undefined)

export const TopicProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [allTopics, setAllTopics] = useState<Topic[]>([])
  const [topic, setTopic] = useState<Topic | null>(null)
  const [cards, setCards] = useState<CardsMap>({})

  const fetchAllTopics = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      const topics = await getAllTopics()
      setAllTopics(topics.sort((a, b) => b.pivot - a.pivot))
    } catch (err) {
      console.error('Failed to load topics:', err)
    } finally {
      setIsLoading(false)
    }
  }, [setAllTopics])

  const fetchTopic = useCallback(
    async (topicId: string): Promise<void> => {
      try {
        const { topic, cards } = await getTopicById(topicId)
        setTopic(topic)
        setCards(cards)
      } catch (error) {
        console.error('Failed to fetch topic:', error)
      }
    },
    [setCards, setTopic]
  )

  const addNewTopic = useCallback(async (topic: Topic) => {
    await createTopic(topic)
    setAllTopics(prev => [topic, ...prev])
  }, [])

  const updateCardsForTopic = (topicId: number, newCards: Card[]) => {
    setCards(prev => ({ ...prev, [topicId]: newCards }))
  }

  const clearCardsForTopic = (topicId: number) => {
    setCards(prev => {
      const { [topicId]: _, ...rest } = prev
      return rest
    })
  }

  return (
    <TopicContext.Provider
      value={{
        isLoading,
        allTopics,
        setAllTopics,
        fetchAllTopics,
        addNewTopic,
        topic,
        setTopic,
        cards,
        setCards,
        fetchTopic,
        updateCardsForTopic,
        clearCardsForTopic
      }}
    >
      {children}
    </TopicContext.Provider>
  )
}

export const useTopic = () => {
  const context = useContext(TopicContext)
  if (!context) throw new Error('useTopic must be used within TopicProvider')
  return context
}
