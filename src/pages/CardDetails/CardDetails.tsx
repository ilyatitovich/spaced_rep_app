import './CardDetails.scss'

import { useState } from 'react'
import {
  LoaderFunctionArgs,
  useLoaderData,
  useNavigate
} from 'react-router-dom'

import Card from '../../components/Card/Card'
import { Topic, LevelId, Card as CardType } from '../../lib/definitions'
import { getTopic, getCard } from '../../lib/utils'
import { Button, Navbar } from '../../components/ui'

// eslint-disable-next-line react-refresh/only-export-components
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
      <Navbar>
        <Button
          onClick={() => {
            navigate(-1)
          }}
        >
          Back
        </Button>
        <h1>{isFlipped ? 'Back' : 'Front'}</h1>
        <Button onClick={deleteCard}>Delete</Button>
      </Navbar>
      <div className="card-container">
        <Card data={card} isFlipped={isFlipped} />
      </div>
      <footer>
        <Button onClick={() => setIsFlipped(!isFlipped)}>Flip</Button>
      </footer>
    </div>
  )
}
