import { useState, useRef, useCallback } from 'react'
import { Toaster, toast } from 'react-hot-toast'

import {
  Button,
  Card,
  Screen,
  CardButton,
  CardContainer,
  BackButton,
  Header
} from '@/components'
import { Card as CardModel } from '@/models'
import { updateCard } from '@/services'
import type { CardHandle } from '@/types'

type CardDetailsScreen = {
  isOpen: boolean
  card: CardModel | null | undefined
  onUpdate?: (card: CardModel) => void
}

export default function CardDetailsScreen({
  isOpen,
  card,
  onUpdate
}: CardDetailsScreen) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState({
    front: card?.data.front ?? '',
    back: card?.data.back ?? ''
  })
  const [isEdited, setIsEdited] = useState(false)
  const [isNewCardData, setIsNewCardData] = useState(false)

  const cardRef = useRef<CardHandle>(null)

  const rightBtn = isEdited ? (
    <Button key="done" onClick={() => setIsEdited(false)}>
      Done
    </Button>
  ) : (
    <Button
      key="save"
      onClick={() => handleSaveCard()}
      disabled={!isNewCardData}
    >
      Save
    </Button>
  )

  const handleSaveCard = async (): Promise<void> => {
    try {
      if (!card) return

      card.data = cardData

      if (card.level === 0 && cardData.front && cardData.back) {
        card.level += 1
      }

      await updateCard(card)
      setIsEdited(false)
      onUpdate?.(card)
      setIsNewCardData(false)

      if (card.level > 0) {
        toast.success('Card updated!', {
          iconTheme: {
            primary: '#05df72',
            secondary: 'white'
          }
        })
        return
      }
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

      if (front !== card?.data.front || back !== card?.data.back) {
        setIsNewCardData(true)
      } else {
        setIsNewCardData(false)
      }

      setCardData({ front, back })
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
      {isOpen && <Toaster position="top-center" reverseOrder={false} />}

      <Header>
        <BackButton />
        <span>{isFlipped ? 'Back' : 'Front'}</span>
        {rightBtn}
      </Header>

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
