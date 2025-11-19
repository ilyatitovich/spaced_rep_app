import { X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

import {
  Card,
  CardsLeftBadge,
  TestDoneMessage,
  AnswerButton
} from '@/components'
import { getToday } from '@/lib'
import { Card as CardModel, Topic } from '@/models'
import { updateCard, updateTopic } from '@/services'

type TestScreenProps = {
  isOpen: boolean
  topic: Topic
  topicCards: Record<number, CardModel[]>
  onClose: () => void
}

export default function TestScreen({
  isOpen,
  topic,
  topicCards,
  onClose
}: TestScreenProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [cards, setCards] = useState<CardModel[] | null>(null)
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [isCorrect, setIsCorrect] = useState(false)

  const totalCardsRef = useRef(0)

  const isDone = cards && cards.length === 0

  useEffect(() => {
    if (isOpen) {
      const result = topic.week[getToday()]!.todayLevels.flatMap(
        levelId => topicCards[levelId]
      ).filter(card => card !== undefined)
      setCards(result)
      totalCardsRef.current = result.length
    } else {
      setCards(null)
      totalCardsRef.current = 0
    }
  }, [topic.week, topicCards, isOpen])

  useEffect(() => {
    async function setTopic(): Promise<void> {
      try {
        topic.week[getToday()]!.isDone = true
        await updateTopic(topic)
      } catch (error) {
        console.error(error)
      }
    }

    if (Array.isArray(cards) && cards.length === 0) {
      setTopic()
    }
  }, [cards, topic])

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

      if (updatedCards.length === 0) {
        setIsFirstCardActive(false)
      } else {
        setIsFirstCardActive(prev => !prev)
      }
    } catch (error) {
      console.error('Error updating card:', error)
    }
  }

  const handleClose = (): void => {
    onClose()
    setIsFlipped(false)
    setIsFirstCardActive(true)
    setIsInitialRender(true)
  }

  return (
    <div
      className={`${isOpen ? 'translate-y-0' : 'translate-y-full'} transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
    >
      <div className="relative p-4 flex justify-between items-center">
        <button onClick={handleClose}>
          <div className="w-8 h-8 flex items-center justify-center bg-black rounded-full">
            <X className="w-4 h-4 text-white" strokeWidth={4} />
          </div>
        </button>

        {!isDone && (
          <span className="font-semibold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            {isFlipped ? 'Back' : 'Front'}
          </span>
        )}

        {cards && (
          <CardsLeftBadge
            current={cards.length}
            total={totalCardsRef.current}
          />
        )}
      </div>

      {cards && (
        <div className="h-[70dvh] flex justify-center items-center">
          {isInitialRender && cards.length === 0 ? (
            <TestDoneMessage />
          ) : (
            <>
              <Card
                className={`${isFirstCardActive ? 'scale-up' : isCorrect ? 'move-right' : 'move-left'}`}
                data={cards[0] ? cards[0].data : { front: '', back: '' }}
                isFlipped={isFirstCardActive ? isFlipped : false}
                handleClick={() => setIsFlipped(prev => !prev)}
              />

              {cards.length > 0 ? (
                <Card
                  className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? (isCorrect ? 'move-right' : 'move-left') : 'scale-up'}`.trim()}
                  data={cards[0].data}
                  isFlipped={isFirstCardActive ? false : isFlipped}
                  handleClick={() => setIsFlipped(prev => !prev)}
                />
              ) : (
                <TestDoneMessage />
              )}
            </>
          )}
        </div>
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
    </div>
  )
}
