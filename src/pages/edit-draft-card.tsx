import { useState, ChangeEvent } from 'react'
import { LoaderFunctionArgs, useLoaderData, useNavigate } from 'react-router'

import Card from '../components/card'
import { Button, Navbar, Content } from '../components/ui'
import { Topic, Card as CardType } from '../lib/definitions'
import { getTopic, getCard } from '../lib/utils'

export async function loader({ params }: LoaderFunctionArgs) {
  const { cardIndx } = params as {
    cardIndx: string
  }
  const topic: Topic = getTopic(params.topicId!)
  const card: CardType = getCard(topic, 'draft', Number(cardIndx))
  return { cardIndx, topic, card }
}

export default function EditDraftCard() {
  const navigate = useNavigate()
  const { cardIndx, topic, card } = useLoaderData() as {
    cardIndx: string
    card: CardType
    topic: Topic
  }
  const { id, levels, draft } = topic
  const firstLevelCards = levels[0].cards

  const [isFlipped, setIsFlipped] = useState<boolean>(false)
  const [cardData, setCardData] = useState({
    front: card.front,
    back: card.back
  })
  const [isEdited, setIsEdited] = useState<boolean>(false)

  const leftBtn = isEdited ? (
    <Button key="done" onClick={() => setIsEdited(false)}>
      Done
    </Button>
  ) : (
    <Button
      key="save"
      onClick={handleSaveCard}
      disabled={!cardData.front || !cardData.back}
    >
      Save
    </Button>
  )

  function handleChange(
    event: ChangeEvent<HTMLTextAreaElement>,
    side: 'front' | 'back'
  ) {
    switch (side) {
      case 'front':
        setCardData({
          ...cardData,
          front: event.target.value
        })
        break
      case 'back':
        setCardData({
          ...cardData,
          back: event.target.value
        })
        break
      default:
        return
    }
  }

  function handleSaveCard() {
    const cardForSave = {
      id: firstLevelCards.length,
      level: 0,
      ...cardData
    }

    draft.splice(Number(cardIndx), 1)
    firstLevelCards.push(cardForSave)

    localStorage.setItem(id, JSON.stringify(topic))
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
        {leftBtn}
      </Navbar>
      <Content centered>
        <Card
          data={cardData}
          isFlipped={isFlipped}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={() => setIsEdited(false)}
          handleChange={handleChange}
        />
      </Content>
      <footer>
        <Button onClick={() => setIsFlipped(!isFlipped)}>Flip</Button>
      </footer>
    </main>
  )
}
