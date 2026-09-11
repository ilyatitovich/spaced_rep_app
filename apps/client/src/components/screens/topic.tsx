import { Settings } from 'lucide-react'
import { useEffect, useState, useRef, useCallback } from 'react'
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
import {
  getTopicById,
  getCardsByTopicAndLevel,
  subscribeSyncData
} from '@/services'

type TopicPageProps = {
  isOpen: boolean
  topicId: string
  onClose: () => void
}

export default function TopicScreen({
  isOpen,
  topicId,
  onClose
}: TopicPageProps) {
  const [topic, setTopic] = useState<Topic | null>(null)
  const [levelCounts, setLevelCounts] = useState<Record<number, number>>({})
  const [levelCards, setLevelCards] = useState<Card[]>([])

  const contentRef = useRef<HTMLDivElement>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const isAddingCard = searchParams.get('addCard') === 'true'
  const isTest = searchParams.get('test') === 'true'
  const levelId = searchParams.get('levelId') ?? ''
  const cardId = searchParams.get('cardId') ?? ''
  const isSettingsOpen = searchParams.get('topicSettings') === 'true'

  const fetchTopic = useCallback(async (): Promise<void> => {
    try {
      const { topic, levelCounts } = await getTopicById(topicId)
      setTopic(topic)
      setLevelCounts(levelCounts)
      const contentEl = contentRef.current
      if (contentEl) {
        contentEl.scrollTop = 0
      }
    } catch (error) {
      console.error('Failed to fetch topic:', error)
    }
  }, [topicId])

  const fetchLevelCards = useCallback(async (): Promise<void> => {
    if (!topicId || !levelId) {
      setLevelCards([])
      return
    }
    try {
      const cards = await getCardsByTopicAndLevel(topicId, Number(levelId))
      setLevelCards(cards)
    } catch (error) {
      console.error('Failed to fetch level cards:', error)
    }
  }, [topicId, levelId])

  useEffect(() => {
    if (!topicId) return

    fetchTopic()
  }, [topicId, isTest, fetchTopic])

  useEffect(() => {
    let cancelled = false

    if (!topicId || !levelId) {
      setLevelCards([])
      return
    }

    void getCardsByTopicAndLevel(topicId, Number(levelId))
      .then(cards => {
        if (!cancelled) setLevelCards(cards)
      })
      .catch(error => {
        if (!cancelled) console.error('Failed to fetch level cards:', error)
      })

    return () => {
      cancelled = true
    }
  }, [topicId, levelId])

  useEffect(() => {
    if (!isOpen || !topicId) return
    return subscribeSyncData(() => {
      void fetchTopic()
      void fetchLevelCards()
    })
  }, [isOpen, topicId, fetchTopic, fetchLevelCards])

  const handleOpenAddCard = (): void => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.set('addCard', 'true')
      return params
    })
  }

  const handleAddCard = (card: { level: number; card: Card }): void => {
    setLevelCounts(prev => ({
      ...prev,
      [card.level]: (prev[card.level] ?? 0) + 1
    }))
    if (levelId && Number(levelId) === card.level) {
      setLevelCards(prev => [...prev, card.card])
    }
  }

  const handleDeleteCards = (cards: Card[]): void => {
    setLevelCards(cards)
    setLevelCounts(prev => ({
      ...prev,
      [Number(levelId)]: cards.length
    }))
  }

  const handleMoveCards = (
    remaining: Card[],
    moved: Card[],
    toLevel: number
  ): void => {
    setLevelCards(remaining)
    setLevelCounts(prev => ({
      ...prev,
      [Number(levelId)]: remaining.length,
      [toLevel]: (prev[toLevel] ?? 0) + moved.length
    }))
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
                  cardsNumber={levelCounts[level] ?? 0}
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
            isOpen={!isAddingCard && isTest}
            topic={topic}
          />

          <LevelScreen
            isOpen={levelId !== ''}
            levelId={levelId}
            isDone={
              topic.week[getToday()]!.isDone &&
              topic.week[getToday()]!.todayLevels.includes(Number(levelId))
            }
            cards={levelCards}
            startDate={topic.pivot}
            onDeleteCards={handleDeleteCards}
            onMoveCards={handleMoveCards}
          />
          <CardDetailsScreen
            isOpen={!!cardId}
            cards={levelCards}
            cardId={cardId}
            onDeleteCards={handleDeleteCards}
            onMoveCards={handleMoveCards}
          />

          <TopicSettingsScreen
            isOpen={isSettingsOpen}
            topic={topic}
            onClose={onClose}
            onCardsImport={async () => {
              await fetchTopic()
              await fetchLevelCards()
            }}
          />
        </>
      )}
    </>
  )
}
