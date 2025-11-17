import { useState, useRef, useEffect } from 'react'

import { Button, Content, Card } from '@/components'
import { Card as CardModel } from '@/models'
import { updateCard } from '@/services'
import type { CardHandle } from '@/types'

type CardDetailsScreen = {
  isOpen: boolean
  card: CardModel | null | undefined
  onClose: () => void
}

export default function CardDetailsScreen({
  isOpen,
  card,
  onClose
}: CardDetailsScreen) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState({
    front: card?.data.front ?? '',
    back: card?.data.back ?? ''
  })
  const [isEdited, setIsEdited] = useState(false)

  const screenRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<CardHandle>(null)

  useEffect(() => {
    if (!isOpen) {
      const node = screenRef.current
      if (!node) return

      const handleEnd = () => {
        setIsFlipped(false)
        cardRef.current?.resetContent()
        node.removeEventListener('transitionend', handleEnd)
      }

      node.addEventListener('transitionend', handleEnd)
      return
    }
  }, [isOpen])

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

  const handleClose = (): void => {
    if (isEdited) {
      setIsEdited(false)
    }
    onClose()
  }

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
    <div
      ref={screenRef}
      className={`${isOpen ? 'translate-y-0' : 'translate-y-full'} transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
    >
      <div className="relative w-full p-4 flex justify-between items-center border-b border-gray-200">
        <Button onClick={handleClose}>Back</Button>
        <span className="font-bold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {isFlipped ? 'Back' : 'Front'}
        </span>
        {rightBtn}
      </div>
      {card && (
        <Content centered>
          <Card
            ref={cardRef}
            data={card.data}
            isFlipped={isFlipped}
            isEditable={true}
            handleFocus={() => setIsEdited(true)}
            handleBlur={handleBlur}
          />
        </Content>
      )}

      <footer>
        <Button onClick={() => setIsFlipped(!isFlipped)}>Flip</Button>
      </footer>
    </div>
  )
}
