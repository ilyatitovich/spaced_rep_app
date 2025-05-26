import { useState, ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Button, Navbar, Content, Card } from '@/components'
import { updateCard } from '@/services'
import { useTopicStore } from '@/stores'

export default function EditCardPage() {
  const navigate = useNavigate()
  const { cardId, levelId } = useParams()

  const cards = useTopicStore(state => state.getLevelCards(Number(levelId)))
  const card = cards.find(card => card.id === cardId)

  const [isFlipped, setIsFlipped] = useState<boolean>(false)
  const [cardData, setCardData] = useState({
    front: card?.data.front ?? '',
    back: card?.data.back ?? ''
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
          front: event.target.value.trim()
        })
        break
      case 'back':
        setCardData({
          ...cardData,
          back: event.target.value.trim()
        })
        break
      default:
        return
    }
  }

  async function handleSaveCard() {
    try {
      if (!card) return

      card.data = cardData

      if (card.level === 0 && cardData.front && cardData.back) {
        card.level += 1
      }

      await updateCard(card)
      navigate(-1)
    } catch (error) {
      console.error('Failed to save card:', error)
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
