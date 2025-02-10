import './CardDetails.scss'

import { useState } from 'react'
import { LoaderFunctionArgs, useLoaderData, useNavigate } from 'react-router'

import Card from '../../components/Card/Card'
import { Topic, LevelId, Card as CardType } from '../../lib/definitions'
import { getTopic, getCard } from '../../lib/utils'

export async function loader({ params }: LoaderFunctionArgs) {
  const { levelId, cardIndx } = params as {
    levelId: LevelId
    cardIndx: string
  }
  const topic: Topic = getTopic(params.topicId!)
  const card: CardType = getCard(topic, levelId, Number(params.cardIndx))
  return { levelId, cardIndx, topic, card }
}

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
    localStorage.setItem(topic.id, JSON.stringify(topic))
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
