import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'

import { Button, Navbar, Content, Card } from '@/components'
import { Card as CardModel } from '@/models'
import { createCard } from '@/services'
import { useTopicStore } from '@/stores'

type CardHandle = {
  getContent: () => { front: string; back: string }
}

export default function NewCard() {
  const navigate = useNavigate()

  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState({ front: '', back: '' })
  const [isEdited, setIsEdited] = useState(false)
  const [isDraft, setIsDraft] = useState(true)
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const { currentTopic } = useTopicStore()

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
    <Button
      key="done"
      onClick={() => {
        if (cardRef.current) {
          const content = cardRef.current.getContent()
          console.log('Saved content:', content)
        }

        console.log('hi')
        setIsEdited(false)
      }}
    >
      Done
    </Button>
  ) : (
    <Button key="save" onClick={() => handleSaveCard('new')}>
      Save
    </Button>
  )

  async function handleSaveCard(cardStatus: 'new' | 'draft') {
    try {
      if (cardRef.current) {
        const content = cardRef.current.getContent()
        console.log('Saved content:', content)
      }
      const card = new CardModel(
        cardData,
        currentTopic!.id,
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

      if (!front.trim() || !back.trim()) {
        setIsDraft(true)
      }

      if (front.trim() && back.trim()) {
        setIsDraft(false)
      }

      setCardData({
        front: front.trim(),
        back: back.trim()
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
        <p>{isFlipped ? 'Back' : 'Front'}</p>
        {rightBtn}
      </Navbar>
      <Content centered>
        <Card
          ref={isFirstCardActive ? cardRef : null}
          className={`${isFirstCardActive ? 'scale-up' : 'move-left'}`}
          data={cardData}
          isFlipped={isFirstCardActive ? isFlipped : false}
          isEditable={true}
          handleFocus={() => {
            console.log('hi')
            setIsEdited(true)
          }}
          handleBlur={handleBlur}
        />
        <Card
          ref={isFirstCardActive ? null : cardRef}
          className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? 'move-left' : 'scale-up'}`.trim()}
          data={cardData}
          isFlipped={isFirstCardActive ? false : isFlipped}
          isEditable={true}
          handleFocus={() => {
            console.log('hi2')
            setIsEdited(true)
          }}
          handleBlur={handleBlur}
        />
      </Content>
      <footer>
        <Button onClick={() => setIsFlipped(!isFlipped)}>Flip</Button>
      </footer>
    </main>
  )
}
