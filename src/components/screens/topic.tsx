import { ChevronLeft, Trash } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router'

import {
  AddCardScreen,
  Button,
  CardDetailsScreen,
  Content,
  TestButton,
  TestScreen,
  LevelRow,
  LevelScreen,
  Week
} from '@/components'
import { getToday } from '@/lib'
import { Day } from '@/lib/helpers'
import { Topic, Card } from '@/models'
import { getTopicById, deleteTopic } from '@/services'

type TopicPageProps = {
  isOpen: boolean
  topicId: string
  onClose: () => void
  onDelete: () => void
}

export default function TopicScreen({
  isOpen,
  topicId,
  onClose,
  onDelete
}: TopicPageProps) {
  const [topic, setTopic] = useState<Topic | null>(null)
  const [cards, setCards] = useState<Record<number, Card[]>>({})

  const contentRef = useRef<HTMLDivElement>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const isAddingCard = searchParams.get('addCard') === 'true'
  const isTest = searchParams.get('test') === 'true'
  const levelId = searchParams.get('levelId') ?? ''
  const cardId = searchParams.get('cardId') ?? ''

  useEffect(() => {
    async function fetchTopic(): Promise<void> {
      try {
        const { topic, cards } = await getTopicById(topicId)
        setTopic(topic)
        setCards(cards)
        const contentEl = contentRef.current
        if (contentEl) {
          contentEl.scrollTop = 0
        }
      } catch (error) {
        console.error('Failed to fetch topic:', error)
      }
    }

    if (!topicId) return

    fetchTopic()
  }, [topicId])

  if (!topic) return null

  const { isDone, todayLevels } = topic.week[getToday()] as Day

  const handleDeleteTopic = async (): Promise<void> => {
    if (!topic) return
    try {
      await deleteTopic(topic.id)
      onDelete()
      onClose()
    } catch (error) {
      console.error('Failed to delete topic.', error)
    }
  }

  const handleOpenAddCard = (): void => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.set('addCard', 'true')
      return params
    })
  }

  const handleCloseAddCard = (): void => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.delete('addCard')
      return params
    })
  }

  const handleAddCard = (card: { level: number; card: Card }): void => {
    setCards(prevCards => {
      const levelCards = prevCards[card.level] || []
      return {
        ...prevCards,
        [card.level]: [...levelCards, card.card]
      }
    })
  }

  return (
    <>
      <div
        className={`${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
      >
        <div className="relative w-full p-4 flex justify-between items-center border-b border-gray-200">
          <Button onClick={onClose}>
            <ChevronLeft />
          </Button>
          <span
            className={`
            font-bold
            absolute
            top-1/2
            left-1/2
            -translate-x-1/2
            -translate-y-1/2
            max-w-[160px]
            truncate
            `}
          >
            {topic.title}
          </span>
          <Button onClick={handleDeleteTopic}>
            <Trash />
          </Button>
        </div>

        <Content height={92} className="pb-30" ref={contentRef}>
          <Week week={topic.week} />

          <div className="flex items-center justify-between mt-10 py-2">
            <span className="font-bold">Levels</span>
            <Button onClick={handleOpenAddCard}>Add Card</Button>
          </div>

          <ul>
            {topic.levels.map(level => (
              <LevelRow
                key={level.id}
                levelId={level.id}
                cardsNumber={cards[level.id]?.length ?? 0}
                onLevelOpen={() =>
                  setSearchParams(prev => {
                    const params = new URLSearchParams(prev)
                    params.set('levelId', String(level.id))
                    return params
                  })
                }
              />
            ))}
          </ul>

          {!isDone && (
            <TestButton
              todayLevels={todayLevels}
              onClick={() =>
                setSearchParams(prev => {
                  const params = new URLSearchParams(prev)
                  params.set('test', 'true')
                  return params
                })
              }
            />
          )}
        </Content>
      </div>

      <AddCardScreen
        isOpen={isAddingCard}
        topicId={topicId}
        onClose={handleCloseAddCard}
        onAdd={handleAddCard}
      />
      <TestScreen
        isOpen={isDone ? false : !isAddingCard && isTest}
        topicCards={cards}
        topic={topic}
        onClose={() => {
          setSearchParams(prev => {
            const params = new URLSearchParams(prev)
            params.delete('test')
            return params
          })
        }}
      />

      <LevelScreen
        isOpen={!!levelId}
        levelId={levelId}
        cards={levelId ? (cards[Number(levelId)] ?? []) : []}
        onDeleteCards={cards => {
          setCards(prev => ({
            ...prev,
            [Number(levelId)]: cards
          }))
        }}
        onShowCardDatails={cardId =>
          setSearchParams(prev => {
            const params = new URLSearchParams(prev)
            params.set('cardId', cardId)
            return params
          })
        }
        onClose={() =>
          setSearchParams(prev => {
            const params = new URLSearchParams(prev)
            params.delete('levelId')
            return params
          })
        }
      />

      <CardDetailsScreen
        isOpen={!!cardId}
        card={
          cardId && levelId
            ? cards[Number(levelId)].find(card => card.id === cardId)
            : null
        }
        onClose={() =>
          setSearchParams(prev => {
            const params = new URLSearchParams(prev)
            params.delete('cardId')
            return params
          })
        }
      />
    </>
  )
}
