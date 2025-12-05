import { useState, useEffect, useRef, useCallback } from 'react'

import {
  Card,
  CardsLeftBadge,
  CardContainer,
  TestDoneMessage,
  AnswerButton,
  Screen,
  BackButton,
  Header
} from '@/components'
import { useTopic } from '@/contexts'
import { getToday } from '@/lib'
import { Card as CardModel, Topic } from '@/models'
import { updateCard, updateTopic } from '@/services'

type TestScreenProps = {
  isOpen: boolean
  topic: Topic
  topicCards: Record<number, CardModel[]>
}

export default function TestScreen({
  isOpen,
  topic,
  topicCards
}: TestScreenProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [cards, setCards] = useState<CardModel[] | null>(null)
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [isCorrect, setIsCorrect] = useState(false)
  const [prevCard, setPrevCard] = useState<CardModel | null>(null)

  const { setAllTopics } = useTopic()

  const totalCardsRef = useRef(0)

  const isDone = cards && cards.length === 0

  useEffect(() => {
    async function setTopic(): Promise<void> {
      try {
        topic.week[getToday()]!.isDone = true
        await updateTopic(topic)
        setAllTopics(prev => prev.map(t => (t.id === topic.id ? topic : t)))
      } catch (error) {
        console.error(error)
      }
    }

    if (Array.isArray(cards) && cards.length === 0) {
      setTopic()
    }
  }, [cards, setAllTopics, topic])

  async function handleAnswer(isCorrect: boolean): Promise<void> {
    try {
      if (!cards) return
      const updatedCards = [...cards]
      const currentCard = updatedCards.shift()

      if (isCorrect) {
        currentCard!.level += 1
      } else {
        currentCard!.level = 1
        updatedCards.push(currentCard!)
      }

      await updateCard(currentCard!)

      setIsCorrect(isCorrect)
      setCards(updatedCards)
      setIsFlipped(false)
      setIsInitialRender(false)
      setPrevCard(cards[0] ?? null)

      if (updatedCards.length === 0) {
        setIsFirstCardActive(false)
      } else {
        setIsFirstCardActive(prev => !prev)
      }
    } catch (error) {
      console.error('Error updating card:', error)
    }
  }

  const handleOpen = useCallback(() => {
    const result = topic.week[getToday()]!.todayLevels.flatMap(
      levelId => topicCards[levelId]
    ).filter(card => card !== undefined)
    setCards(result)
    totalCardsRef.current = result.length
  }, [topic.week, topicCards])

  const handleClose = useCallback(() => {
    setIsFlipped(false)
    setIsFirstCardActive(true)
    setIsInitialRender(true)
    setPrevCard(null)
    setIsCorrect(false)
    setCards(null)
    totalCardsRef.current = 0
  }, [])

  return (
    <Screen
      isOpen={isOpen}
      onClose={handleClose}
      onOpen={handleOpen}
      isVertical
    >
      <Header>
        <BackButton icon="x" />
        {!isDone && <span>{isFlipped ? 'Back' : 'Front'}</span>}
        {cards && (
          <CardsLeftBadge
            current={cards.length}
            total={totalCardsRef.current}
          />
        )}
      </Header>

      {cards && (
        <CardContainer>
          {cards.length === 0 ? (
            <TestDoneMessage />
          ) : (
            <>
              <Card
                className={`${isFirstCardActive ? 'scale-up' : isCorrect ? 'move-right' : 'move-left'}`.trim()}
                data={
                  prevCard
                    ? isFirstCardActive
                      ? cards[0].data
                      : prevCard.data
                    : cards[0].data
                }
                isFlipped={isFirstCardActive ? isFlipped : false}
                handleClick={() => setIsFlipped(prev => !prev)}
              />

              {cards.length > 0 ? (
                <Card
                  className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? (isCorrect ? 'move-right' : 'move-left') : 'scale-up'}`.trim()}
                  data={
                    prevCard
                      ? isFirstCardActive
                        ? prevCard.data
                        : cards[0].data
                      : cards[0].data
                  }
                  isFlipped={isFirstCardActive ? false : isFlipped}
                  handleClick={() => setIsFlipped(prev => !prev)}
                />
              ) : (
                <TestDoneMessage />
              )}
            </>
          )}
        </CardContainer>
      )}

      {!isDone && (
        <div className="w-full mt-4 flex justify-evenly gap-1.5 text-white font-semibold">
          {isFlipped ? (
            <div className="flex gap-6">
              <AnswerButton isCorrect={false} onAnswer={handleAnswer} />
              <AnswerButton isCorrect={true} onAnswer={handleAnswer} />
            </div>
          ) : (
            <span className="text-gray-400 text-sm">
              tap on card to reweal answer
            </span>
          )}
        </div>
      )}
    </Screen>
  )
}
