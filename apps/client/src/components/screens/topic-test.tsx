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
import { useShortcuts } from '@/hooks'
import {
  completeStudyDay,
  flipRules,
  getToday,
  getTopScreen,
  gradeCard,
  gradeRules,
  selectDueCards
} from '@/lib'
import { Card as CardModel, Topic } from '@/models'
import { getCardsByTopicAndLevel, updateCard, updateTopic } from '@/services'

interface TestScreenProps {
  isOpen: boolean
  topic: Topic
}

// oxlint-disable-next-line sonarjs/cognitive-complexity
export default function TestScreen({ isOpen, topic }: TestScreenProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [cards, setCards] = useState<CardModel[] | null>(null)
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [isCorrect, setIsCorrect] = useState(false)
  const [prevCard, setPrevCard] = useState<CardModel | null>(null)

  const totalCardsRef = useRef(0)
  const hostRef = useRef<HTMLDivElement>(null)

  const isDone = cards && cards.length === 0

  const handleFlipCard = () => {
    if (!getTopScreen()?.contains(hostRef.current)) return
    setIsFlipped(prev => !prev)
  }

  const handleGrade = (isCorrect: boolean) => {
    if (!getTopScreen()?.contains(hostRef.current)) return
    void handleAnswer(isCorrect)
  }

  useShortcuts(
    flipRules,
    { flipCard: handleFlipCard },
    { enabled: isOpen && !isDone }
  )

  useShortcuts(
    gradeRules,
    {
      wrong: () => handleGrade(false),
      correct: () => handleGrade(true)
    },
    { enabled: isOpen && !isDone && isFlipped }
  )

  useEffect(() => {
    async function setTopic(): Promise<void> {
      try {
        completeStudyDay(topic.week[getToday()]!)
        await updateTopic(topic)
      } catch (error) {
        console.error(error)
      }
    }

    if (isDone) {
      setTopic()
    }
  }, [isDone, topic])

  async function handleAnswer(isCorrect: boolean): Promise<void> {
    try {
      if (!cards) return
      const currentCard = cards.shift()
      if (!currentCard) return

      const graded = gradeCard(currentCard.level, isCorrect, Date.now())
      currentCard.level = graded.level
      currentCard.reviewDate = graded.reviewDate

      await updateCard(currentCard)

      setIsCorrect(isCorrect)
      setCards(cards)
      setIsFlipped(false)
      setIsInitialRender(false)
      setPrevCard(currentCard)
      setIsFirstCardActive(prev => !prev)
    } catch (error) {
      console.error('Error updating card:', error)
    }
  }

  const handleOpen = useCallback(() => {
    void (async () => {
      const todayLevels = topic.week[getToday()]!.todayLevels
      const byLevel = await Promise.all(
        todayLevels.map(level => getCardsByTopicAndLevel(topic.id, level))
      )
      const testCards = selectDueCards(byLevel.flat(), todayLevels, Date.now())
      setCards(testCards)
      totalCardsRef.current = testCards.length
    })()
  }, [topic.id, topic.week])

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
        <span className={isDone ? 'invisible' : undefined}>
          {isFlipped ? 'Back' : 'Front'}
        </span>
        {cards && (
          <CardsLeftBadge
            current={cards.length}
            total={totalCardsRef.current}
          />
        )}
      </Header>

      {cards && (
        <div ref={hostRef} className="contents">
          <CardContainer>
            {cards.length === 0 && isFirstCardActive ? (
              <div className="absolute w-[80vw] max-w-87.5 h-[60dvh] max-h-125 scale-up">
                <TestDoneMessage />
              </div>
            ) : (
              (isFirstCardActive ? cards[0] : prevCard) && (
                <Card
                  className={`${isFirstCardActive ? 'scale-up' : isCorrect ? 'move-right' : 'move-left'}`.trim()}
                  data={(isFirstCardActive ? cards[0]! : prevCard!).data}
                  isFlipped={isFirstCardActive ? isFlipped : false}
                  handleClick={() => setIsFlipped(prev => !prev)}
                />
              )
            )}

            {cards.length === 0 && !isFirstCardActive ? (
              <div className="absolute w-[80vw] max-w-87.5 h-[60dvh] max-h-125 scale-up">
                <TestDoneMessage />
              </div>
            ) : (
              (isFirstCardActive ? prevCard : cards[0]) && (
                <Card
                  className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? (isCorrect ? 'move-right' : 'move-left') : 'scale-up'}`.trim()}
                  data={(isFirstCardActive ? prevCard! : cards[0]!).data}
                  isFlipped={isFirstCardActive ? false : isFlipped}
                  handleClick={() => setIsFlipped(prev => !prev)}
                />
              )
            )}
          </CardContainer>
        </div>
      )}

      {!isDone && (
        <div className="w-full mt-4 flex justify-evenly gap-1.5 font-semibold">
          {isFlipped ? (
            <div className="flex gap-6">
              <AnswerButton isCorrect={false} onAnswer={handleAnswer} />
              <AnswerButton isCorrect={true} onAnswer={handleAnswer} />
            </div>
          ) : (
            <span className="text-foreground-subtle text-sm">
              tap on card to reweal answer
            </span>
          )}
        </div>
      )}
    </Screen>
  )
}
