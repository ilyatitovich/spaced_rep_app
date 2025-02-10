import './EditdraftCard.scss'

import { useState, ChangeEvent } from 'react'
import { useLoaderData, useNavigate } from 'react-router'

import Card from '../../components/Card/Card'
import { Topic, Card as CardType } from '../../lib/definitions'

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
    <button key="done" onClick={() => setIsEdited(false)}>
      Done
    </button>
  ) : (
    <button
      key="save"
      onClick={handleSaveCard}
      disabled={!cardData.front || !cardData.back}
    >
      Save
    </button>
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
    <div className="screen new-card">
      <nav>
        <button
          onClick={() => {
            navigate(-1)
          }}
        >
          Back
        </button>
        <p>{isFlipped ? 'Back' : 'Front'}</p>
        {leftBtn}
      </nav>
      <div className="card-container">
        <Card
          data={cardData}
          isFlipped={isFlipped}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={() => setIsEdited(false)}
          handleChange={handleChange}
        />
      </div>
      <footer>
        <button onClick={() => setIsFlipped(!isFlipped)}>Flip</button>
      </footer>
    </div>
  )
}
