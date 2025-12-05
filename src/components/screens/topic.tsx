import { Settings } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

import {
  AddCardScreen,
  // CardDetailsScreen,
  TestButton,
  TestScreen,
  LevelRow,
  // LevelScreen,
  Week,
  BackButton,
  Header,
  TopicSettingsScreen
} from '@/components'
import { OpenButton } from '@/components'
import { useTopic } from '@/contexts'
import { getToday, LEVELS } from '@/lib'
// import { Card } from '@/models'
// import { getTopicById } from '@/services'

type TopicPageProps = {
  isOpen: boolean
  topicId: string
  onClose: () => void
}

export default function TopicScreen({ isOpen, topicId }: TopicPageProps) {
  const { topic, cards, fetchTopic } = useTopic()

  const contentRef = useRef<HTMLDivElement>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const isSettingsOpen = searchParams.get('topicSettings') === 'true'
  const isAddingCard = searchParams.get('addCard') === 'true'
  const isTest = searchParams.get('test') === 'true'
  // const levelId = searchParams.get('levelId') ?? ''
  // const cardId = searchParams.get('cardId') ?? ''

  useEffect(() => {
    if (!topicId) return

    fetchTopic(topicId)
    const contentEl = contentRef.current
    if (contentEl) {
      contentEl.scrollTop = 0
    }
    console.log(topicId)
  }, [topicId, isTest, fetchTopic])

  return (
    <>
      <div
        className={`${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
      >
        <Header>
          <BackButton />
          <span>{topic?.title}</span>
          <OpenButton param="topicSettings">
            <Settings />
          </OpenButton>
        </Header>

        {topic && (
          <div ref={contentRef} className="h-[92dvh] p-4 pb-30 overflow-y-auto">
            <Week week={topic.week} />

            <div className="flex items-center justify-between mt-10 py-2">
              <span className="font-bold">Levels</span>
              <OpenButton param="addCard">Add Card</OpenButton>
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
          <TopicSettingsScreen isOpen={isSettingsOpen} />
          <AddCardScreen isOpen={isAddingCard} />
          <TestScreen
            isOpen={
              topic?.week[getToday()]!.isDone ? false : !isAddingCard && isTest
            }
            topicCards={cards}
            topic={topic}
          />

          {/* <LevelScreen
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
          /> */}
          {/* <CardDetailsScreen
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
          /> */}
        </>
      )}
    </>
  )
}
