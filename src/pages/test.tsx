import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'

import { Button, Navbar, Content, Card } from '@/components'
import { Card as CardModel } from '@/models'
import { updateCard } from '@/services'
import { useTopicStore } from '@/stores/topic.store'

const today: number = new Date().getDay()

export default function TestPage() {
  const navigate = useNavigate()
  const topic = useTopicStore(state => state.currentTopic)
  const topicCards = useTopicStore(state => state.topicCards)
  const setTopic = useTopicStore(state => state.setTopic)

  const { week } = topic!

  const [isFlipped, setIsFlipped] = useState(false)

  const [cards, setCards] = useState<CardModel[]>([])
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [isCorrect, setIsCorrect] = useState(false)

  useEffect(() => {
    const result = week[today]!.todayLevels.flatMap(
      levelId => topicCards[levelId]
    )
    setCards(result)
  }, [week, topicCards])

  useEffect(() => {
    if (cards.length === 0) {
      week[today]!.isDone = true
      setTopic(topic)
    }
  }, [cards.length, setTopic, topic, week])

  async function handleAnswer(isCorrect: boolean): Promise<void> {
    try {
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

  return (
    <main>
      <Navbar>
        <Button
          onClick={() => {
            navigate(-1)
          }}
        >
          Back
        </Button>
        <h1>{isFlipped ? 'Back' : 'Front'}</h1>
        <div className="py-2 px-4 rounded-full bg-light-gray flex items-center justify-center">
          {cards.length}
        </div>
      </Navbar>

      <Content centered>
        {isInitialRender && cards.length === 0 ? (
          <p>No cards</p>
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
              <p>No cards</p>
            )}
          </>
        )}
      </Content>

      <div className="w-full absolute bottom-4 mt-8 flex justify-evenly gap-2">
        {isFlipped ? (
          <>
            <button
              className="bg-red text-white py-3 px-10 rounded-md"
              onClick={() => handleAnswer(false)}
            >
              Wrong
            </button>
            <button
              className="bg-green text-white py-3 px-10 rounded-md"
              onClick={() => handleAnswer(true)}
            >
              Correct
            </button>
          </>
        ) : (
          <small className="text-light-gray">
            tap on card to reweal answer
          </small>
        )}
      </div>
    </main>
  )
}
