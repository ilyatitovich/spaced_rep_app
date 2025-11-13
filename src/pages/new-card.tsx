import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Button, Navbar, Content, Card } from '@/components'
import { Card as CardModel } from '@/models'
import { createCard } from '@/services'
import type { CardHandle, CardData } from '@/types'

const initialCardData: CardData = {
  front: '',
  back: ''
}

export default function NewCardPage() {
  const navigate = useNavigate()
  const { topicId } = useParams()

  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState(initialCardData)
  const [isEdited, setIsEdited] = useState(false)
  const [isDraft, setIsDraft] = useState(true)
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const cardRef = useRef<CardHandle>(null)

  let rightBtn

  if (isEdited) {
    rightBtn = (
      <Button key="done" onClick={() => setIsEdited(false)}>
        Done
      </Button>
    )
  } else if (isDraft) {
    rightBtn = (
      <Button
        key="save-draft"
        onClick={() => handleSaveCard('draft')}
        disabled={!cardData.front}
      >
        Save Draft
      </Button>
    )
  } else {
    rightBtn = (
      <Button key="save" onClick={() => handleSaveCard('new')}>
        Save
      </Button>
    )
  }

  async function handleSaveCard(cardStatus: 'new' | 'draft'): Promise<void> {
    try {
      if (!topicId) {
        console.error('Topic ID is required to save the card.')
        return
      }

      const card = new CardModel(
        cardData,
        topicId,
        cardStatus === 'new' ? 1 : 0
      )
      await createCard(card)

      setCardData(initialCardData)
      setIsFlipped(false)
      setIsDraft(true)
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
          data={isFirstCardActive ? initialCardData : cardData}
          isFlipped={isFirstCardActive ? isFlipped : false}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
        />
        <Card
          ref={isFirstCardActive ? null : cardRef}
          className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? 'move-left' : 'scale-up'}`.trim()}
          data={isFirstCardActive ? cardData : initialCardData}
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
