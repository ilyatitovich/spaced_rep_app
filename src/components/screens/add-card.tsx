import { useState, useRef } from 'react'

import {
  Button,
  Card,
  BackButton,
  CardButton,
  CardContainer,
  Screen
} from '@/components'
import { Card as CardModel } from '@/models'
import { createCard } from '@/services'
import type { CardHandle, CardData } from '@/types'

type NewCardPageProps = {
  isOpen: boolean
  topicId: string
  onAdd: (payload: { level: number; card: CardModel }) => void
}

const initialCardData: CardData = {
  front: '',
  back: ''
}

export default function AddCardScreen({
  isOpen,
  topicId,
  onAdd
}: NewCardPageProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState(initialCardData)
  const [isEdited, setIsEdited] = useState(false)
  const [isDraft, setIsDraft] = useState(true)
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const currentCardRef = useRef<CardHandle>(null)
  const secondCardRef = useRef<CardHandle>(null)

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
      onAdd({ level: card.level, card })
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
    if (currentCardRef.current) {
      const { front, back } = currentCardRef.current.getContent()

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

  const handleClose = (): void => {
    if (isEdited) {
      setIsEdited(false)
    }
    setCardData(initialCardData)
    setIsFlipped(false)
    setIsDraft(true)
    setIsFirstCardActive(true)
    setIsInitialRender(true)
    currentCardRef.current?.resetContent()
    secondCardRef.current?.resetContent()
  }

  return (
    <Screen isOpen={isOpen} onClose={handleClose} isVertical>
      <div className="relative p-4 flex justify-between items-center">
        <BackButton />
        <span className="font-bold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {isFlipped ? 'Back' : 'Front'}
        </span>
        {rightBtn}
      </div>
      <CardContainer>
        <Card
          ref={isFirstCardActive ? currentCardRef : secondCardRef}
          className={`${isFirstCardActive ? 'scale-up' : 'move-right'}`}
          data={isFirstCardActive ? initialCardData : cardData}
          isFlipped={isFirstCardActive ? isFlipped : false}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
        />
        <Card
          ref={isFirstCardActive ? secondCardRef : currentCardRef}
          className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? 'move-right' : 'scale-up'}`.trim()}
          data={isFirstCardActive ? cardData : initialCardData}
          isFlipped={isFirstCardActive ? false : isFlipped}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
        />
      </CardContainer>
      {/* Buttons */}
      <div className="pt-1 flex justify-center items-center gap-12">
        <CardButton type="flip" onClick={() => setIsFlipped(prev => !prev)} />
      </div>
    </Screen>
  )
}
