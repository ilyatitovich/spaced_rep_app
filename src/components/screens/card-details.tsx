import { useState, useRef, useCallback } from 'react'

import {
  Button,
  Card,
  Screen,
  CardButton,
  CardContainer,
  BackButton
} from '@/components'
import { Card as CardModel } from '@/models'
import { updateCard } from '@/services'
import type { CardHandle } from '@/types'

type CardDetailsScreen = {
  isOpen: boolean
  card: CardModel | null | undefined
}

export default function CardDetailsScreen({ isOpen, card }: CardDetailsScreen) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState({
    front: card?.data.front ?? '',
    back: card?.data.back ?? ''
  })
  const [isEdited, setIsEdited] = useState(false)

  const cardRef = useRef<CardHandle>(null)

  const rightBtn = isEdited ? (
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

  async function handleSaveCard() {
    try {
      if (!card) return

      card.data = cardData

      if (card.level === 0 && cardData.front && cardData.back) {
        card.level += 1
      }

      await updateCard(card)
      setIsEdited(false)
    } catch (error) {
      console.error('Failed to save card:', error)
    }
  }

  const handleClose = useCallback(() => {
    if (isEdited) {
      setIsEdited(false)
    }
    setIsFlipped(false)
    setCardData({
      front: '',
      back: ''
    })
    cardRef.current?.resetContent()
  }, [isEdited])

  const handleOpen = useCallback(() => {
    setCardData({
      front: card?.data.front ?? '',
      back: card?.data.back ?? ''
    })
  }, [card])

  const handleBlur = (): void => {
    if (cardRef.current) {
      const { front, back } = cardRef.current.getContent()

      setCardData({
        front: front,
        back: back
      })
    }
    setIsEdited(false)
  }

  return (
    <Screen
      isOpen={isOpen}
      onClose={handleClose}
      onOpen={handleOpen}
      isVertical
    >
      <div className="relative w-full p-4 flex justify-between items-center">
        <BackButton />
        <span className="font-bold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {isFlipped ? 'Back' : 'Front'}
        </span>
        {rightBtn}
      </div>

      <CardContainer>
        <Card
          ref={cardRef}
          data={cardData}
          isFlipped={isFlipped}
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
