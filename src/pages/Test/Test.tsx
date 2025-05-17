import './Test.scss'

import { AnimatePresence } from 'motion/react'
import { useState, useEffect } from 'react'
import { useNavigate, useLoaderData } from 'react-router'

import Card from '../../components/Card/Card'
import { saveTopic } from '@/lib/db'
import { Topic } from '@/models'

export default function Test() {
  const navigate = useNavigate()
  const { topic, today } = useLoaderData() as { topic: Topic; today: number }
  const { week, levels } = topic

  const [isFlipped, setIsFlipped] = useState<boolean>(false)

  const cardsForTest = week[today]!.reviewLevels.flatMap(el => levels[el].cards)
  const [cards, setCards] = useState(cardsForTest)
  const [isMoved, setIsMoved] = useState<boolean>(false)

  useEffect(() => {
    let timer: NodeJS.Timeout

    if (isMoved) {
      timer = setTimeout(() => {
        setIsMoved(false)
      }, 100)
    }

    return () => {
      clearTimeout(timer)
    }
  }, [isMoved])

  if (cards.length === 0) {
    week[today]!.isCompleted = true
    saveTopic(topic)
  }

  function handleAnswer(answer: 'correct' | 'wrong') {
    const updatedCards = [...cards]
    const currentCard = updatedCards.shift()
    const indexToDelete = levels[currentCard!.level].cards.indexOf(currentCard!)
    levels[currentCard!.level].cards.splice(indexToDelete, 1)

    if (answer === 'correct') {
      currentCard!.level += 1
      levels[currentCard!.level].cards.push(currentCard!)
    } else {
      currentCard!.level = 0
      levels[0].cards.push(currentCard!)
      updatedCards.push(currentCard!)
    }

    saveTopic(topic)

    setIsMoved(true)
    setCards(updatedCards)
    setIsFlipped(false)
  }

  return (
    <div className="test">
      <nav>
        <button
          onClick={() => {
            navigate(-1)
          }}
        >
          Back
        </button>
        <p>{isFlipped ? 'Back' : 'Front'}</p>
        <small className="cards-num">{cards.length}</small>
      </nav>
      <div className="card-container">
        {!isMoved &&
          (cards.length > 0 ? (
            <AnimatePresence>
              <Card
                data={cards[0]}
                isFlipped={isFlipped}
                handleClick={() => setIsFlipped(!isFlipped)}
              />
            </AnimatePresence>
          ) : (
            <div>No cards</div>
          ))}
      </div>

      <div className="btns-container">
        {isFlipped ? (
          <>
            <button className="wrong" onClick={() => handleAnswer('wrong')}>
              Wrong
            </button>
            <button className="correct" onClick={() => handleAnswer('correct')}>
              Correct
            </button>
          </>
        ) : (
          <small>tap on card to reweal answer</small>
        )}
      </div>
    </div>
  )
}
