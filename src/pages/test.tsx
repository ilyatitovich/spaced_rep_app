import { AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'

import { Button, Navbar, Content, Card } from '@/components'
import { updateCard } from '@/services'
import { useTopicStore } from '@/stores/topic.store'

export default function TestPage() {
  const navigate = useNavigate()
  const topic = useTopicStore(state => state.currentTopic)
  const setTopic = useTopicStore(state => state.setTopic)
  const today: number = new Date().getDay()

  const { week, levels } = topic!

  const [isFlipped, setIsFlipped] = useState<boolean>(false)

  const cardsForTest = week[today]!.todayLevels.flatMap(el => levels[el].cards)
  const [cards, setCards] = useState(cardsForTest)
  const [isMoved, setIsMoved] = useState<boolean>(false)

  useEffect(() => {
    let timer: NodeJS.Timeout

    if (isMoved) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timer = setTimeout(() => {
        setIsMoved(false)
      }, 100)
    }

    return () => {
      setTopic(topic)
      clearTimeout(timer)
    }
  }, [isMoved, setTopic, topic])

  if (cards.length === 0) {
    week[today]!.isDone = true
  }

  async function handleAnswer(isCorrect: boolean) {
    try {
      const updatedCards = [...cards]
      const currentCard = updatedCards.shift()
      const indexToDelete = levels[currentCard!.level].cards.indexOf(
        currentCard!
      )
      levels[currentCard!.level].cards.splice(indexToDelete, 1)

      if (isCorrect) {
        currentCard!.level += 1
        levels[currentCard!.level].cards.push(currentCard!)
      } else {
        currentCard!.level = 1
        levels[1].cards.push(currentCard!)
        updatedCards.push(currentCard!)
      }

      await updateCard(currentCard!)
      setIsMoved(true)
      setCards(updatedCards)
      setIsFlipped(false)
    } catch (error) {
      console.error('Error updating card:', error)
    }
  }

  return (
    <main className="test">
      <Navbar>
        <Button
          onClick={() => {
            navigate(-1)
          }}
        >
          Back
        </Button>
        <p>{isFlipped ? 'Back' : 'Front'}</p>
        <div className="py-2 px-4 rounded-full bg-light-gray flex items-center justify-center">
          {cards.length}
        </div>
      </Navbar>

      <Content centered>
        {!isMoved &&
          (cards.length > 0 ? (
            <AnimatePresence>
              <Card
                data={cards[0].data}
                isFlipped={isFlipped}
                handleClick={() => setIsFlipped(!isFlipped)}
              />
            </AnimatePresence>
          ) : (
            <div>No cards</div>
          ))}
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
