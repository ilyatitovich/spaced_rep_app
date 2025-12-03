import { Settings } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router'

import {
  AddCardScreen,
  Button,
  CardDetailsScreen,
  TestButton,
  TestScreen,
  LevelRow,
  LevelScreen,
  Week,
  BackButton,
  Header,
  TopicSettingsScreen
} from '@/components'
import { getToday, LEVELS } from '@/lib'
import { Topic, Card } from '@/models'
import { getTopicById } from '@/services'

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
  const isSettingsOpen = searchParams.get('topicSettings') === 'true'

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
  }, [topicId, isTest])

  const handleOpenAddCard = (): void => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.set('addCard', 'true')
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
        <Header>
          <BackButton />
          <span>{topic?.title}</span>
          <Button
            onClick={() =>
              setSearchParams(prev => {
                const params = new URLSearchParams(prev)
                params.set('topicSettings', 'true')
                return params
              })
            }
          >
            <Settings />
          </Button>
        </Header>

        {topic && (
          <div ref={contentRef} className="h-[92dvh] p-4 pb-30 overflow-y-auto">
            <Week week={topic.week} />

            <div className="flex items-center justify-between mt-10 py-2">
              <span className="font-bold">Levels</span>
              <Button onClick={handleOpenAddCard}>Add Card</Button>
            </div>

            <ul>
              {LEVELS.map(level => (
                <LevelRow
                  key={level}
                  levelId={level}
                  cardsNumber={cards[level]?.length ?? 0}
                  onLevelOpen={() =>
                    setSearchParams(prev => {
                      const params = new URLSearchParams(prev)
                      params.set('levelId', String(level))
                      return params
                    })
                  }
                />
              ))}
            </ul>

            {!topic.week[getToday()]?.isDone && (
              <TestButton
                todayLevels={topic.week[getToday()]!.todayLevels}
                onClick={() =>
                  setSearchParams(prev => {
                    const params = new URLSearchParams(prev)
                    params.set('test', 'true')
                    return params
                  })
                }
              />
            )}
          </div>
        )}
      </div>

      {topic && (
        <>
          <AddCardScreen
            isOpen={isAddingCard}
            topicId={topicId}
            onAdd={handleAddCard}
          />
          <TestScreen
            isOpen={
              topic?.week[getToday()]!.isDone ? false : !isAddingCard && isTest
            }
            topicCards={cards}
            topic={topic}
          />

          <LevelScreen
            isOpen={levelId !== ''}
            levelId={levelId}
            cards={levelId ? (cards[Number(levelId)] ?? []) : []}
            startDate={topic.pivot}
            onDeleteCards={(cards: Card[]) => {
              setCards(prev => ({
                ...prev,
                [Number(levelId)]: cards
              }))
            }}
          />
          <CardDetailsScreen
            isOpen={!!cardId}
            card={
              cardId && levelId
                ? cards[Number(levelId)].find(card => card.id === cardId)
                : null
            }
            onUpdate={card => {
              if (levelId !== '0') return
              setCards(prevCards => ({
                ...prevCards,
                [0]: prevCards[0].filter(c => c.id !== card.id),
                [1]: [...(prevCards[1] || []), card]
              }))
              setSearchParams(prev => {
                const params = new URLSearchParams(prev)
                params.delete('cardId')
                return params
              })
            }}
          />

          <TopicSettingsScreen
            isOpen={isSettingsOpen}
            topic={topic}
            onClose={onClose}
            onDelete={onDelete}
          />
        </>
      )}
    </>
  )
}
