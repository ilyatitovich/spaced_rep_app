import { useState } from 'react'
import { useLoaderData, useNavigate } from 'react-router'

import { Button, Navbar, Content, Card } from '@/components'
import { Topic, LevelId, Card as CardType } from '@/lib/definitions'

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
        <Button onClick={deleteCard}>Delete</Button>
      </Navbar>
      <Content centered>
        <Card data={card} isFlipped={isFlipped} />
      </Content>
      <footer>
        <Button onClick={() => setIsFlipped(!isFlipped)}>Flip</Button>
      </footer>
    </main>
  )
}
