import './CardDetails.scss'

import { Card } from '@/components'
import { saveTopic } from '@/lib/db'
import { Topic } from '@/models'
import { LevelId, Card as CardType } from '@/types'
import { useState } from 'react'
import { useLoaderData, useNavigate } from 'react-router'

export default function CardDetails() {
  const { levelId, cardIndx, topic, card } = useLoaderData() as {
    levelId: LevelId
    cardIndx: string
    card: CardType
    topic: Topic
  }
  const navigate = useNavigate()
  const [isFlipped, setIsFlipped] = useState<boolean>(false)

  function deleteCard() {
    topic.levels[Number(levelId) - 1].cards.splice(Number(cardIndx), 1)
    saveTopic(topic)
    navigate(-1)
  }

  return (
    <div className="screen card-details">
      <nav>
        <button
          onClick={() => {
            navigate(-1)
          }}
        >
          Back
        </button>
        <p>{isFlipped ? 'Back' : 'Front'}</p>
        <button onClick={deleteCard}>Delete</button>
      </nav>
      <div className="card-container">
        <Card data={card} isFlipped={isFlipped} />
      </div>
      <footer>
        <button onClick={() => setIsFlipped(!isFlipped)}>Flip</button>
      </footer>
    </div>
  )
}
