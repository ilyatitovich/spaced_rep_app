import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Button, Navbar, Content, Card } from '@/components'
import { Card as CardModel } from '@/models'
import { createCard } from '@/services'
import type { CardHandle, CardData } from '@/types'

export default function NewCard() {
  const navigate = useNavigate()
  const { topicId } = useParams()

  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState<CardData>({ front: '', back: '' })
  const [isEdited, setIsEdited] = useState(false)
  const [isDraft, setIsDraft] = useState(true)
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const cardRef = useRef<CardHandle>(null)

  const rightBtn = isDraft ? (
    isEdited ? (
      <Button key="done" onClick={() => setIsEdited(false)}>
        Done
      </Button>
    ) : (
      <Button
        key="save-draft"
        onClick={() => handleSaveCard('draft')}
        disabled={!!cardData.front === false}
      >
        Save Draft
      </Button>
    )
  ) : isEdited ? (
    <Button key="done" onClick={() => setIsEdited(false)}>
      Done
    </Button>
  ) : (
    <Button key="save" onClick={() => handleSaveCard('new')}>
      Save
    </Button>
  )

  async function handleSaveCard(cardStatus: 'new' | 'draft') {
    try {
      const card = new CardModel(
        cardData,
        topicId!,
        cardStatus === 'new' ? 1 : 0
      )
      await createCard(card)

      setCardData({ front: '', back: '' })
      setIsFlipped(false)
      setIsFirstCardActive(prev => !prev)
      setIsInitialRender(false)
    } catch (error) {
      console.error('Failed to save card:', error)
    }
  }

  function handleBlur(): void {
    if (cardRef.current) {
      const { front, back } = cardRef.current.getContent()

      if (!front || !back) {
        setIsDraft(true)
      }

      if (front && back) {
        setIsDraft(false)
      }

      setCardData({
        front: front,
        back: back
      })
    }
    setIsEdited(false)
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
        <p className="font-bold">{isFlipped ? 'Back' : 'Front'}</p>
        {rightBtn}
      </Navbar>
      <Content centered>
        <Card
          ref={isFirstCardActive ? cardRef : null}
          className={`${isFirstCardActive ? 'scale-up' : 'move-left'}`}
          data={cardData}
          isFlipped={isFirstCardActive ? isFlipped : false}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
        />
        <Card
          ref={isFirstCardActive ? null : cardRef}
          className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? 'move-left' : 'scale-up'}`.trim()}
          data={cardData}
          isFlipped={isFirstCardActive ? false : isFlipped}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
        />
      </Content>
      <footer>
        <Button onClick={() => setIsFlipped(!isFlipped)}>Flip</Button>
      </footer>
    </main>
  )
}
