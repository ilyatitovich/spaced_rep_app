import { useState, useRef, useEffect } from 'react'

import { Button, Content, Card } from '@/components'
import { Card as CardModel } from '@/models'
import { createCard } from '@/services'
import type { CardHandle, CardData } from '@/types'

type NewCardPageProps = {
  isOpen: boolean
  topicId: string
  onClose: () => void
  onAdd: (payload: { level: number; card: CardModel }) => void
}

const initialCardData: CardData = {
  front: '',
  back: ''
}

export default function AddCardScreen({
  isOpen,
  topicId,
  onClose,
  onAdd
}: NewCardPageProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState(initialCardData)
  const [isEdited, setIsEdited] = useState(false)
  const [isDraft, setIsDraft] = useState(true)
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const screenRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<CardHandle>(null)

  useEffect(() => {
    if (!isOpen) {
      const node = screenRef.current
      if (!node) return

      const handleEnd = () => {
        setCardData(initialCardData)
        setIsFlipped(false)
        setIsDraft(true)
        setIsFirstCardActive(true)
        setIsInitialRender(true)
        cardRef.current?.resetContent()
        node.removeEventListener('transitionend', handleEnd)
      }

      node.addEventListener('transitionend', handleEnd)
    }
  }, [isOpen])

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

  const handleClose = (): void => {
    if (isEdited) {
      setIsEdited(false)
    }
    onClose()
  }

  return (
    <div
      ref={screenRef}
      className={`${isOpen ? 'translate-y-0' : 'translate-y-full'} h-full transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
    >
      <div className="relative w-full p-4 flex justify-between items-center border-b border-gray-200">
        <Button onClick={handleClose}>Back</Button>
        <span className="font-bold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {isFlipped ? 'Back' : 'Front'}
        </span>
        {rightBtn}
      </div>
      <Content centered>
        <Card
          ref={isFirstCardActive ? cardRef : null}
          className={`${isFirstCardActive ? 'scale-up' : 'move-right'}`}
          data={isFirstCardActive ? initialCardData : cardData}
          isFlipped={isFirstCardActive ? isFlipped : false}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
        />
        <Card
          ref={isFirstCardActive ? null : cardRef}
          className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? 'move-right' : 'scale-up'}`.trim()}
          data={isFirstCardActive ? cardData : initialCardData}
          isFlipped={isFirstCardActive ? false : isFlipped}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
        />
      </Content>
      <div className="flex justify-center items-center p-4 border-t border-gray-200">
        <Button onClick={() => setIsFlipped(!isFlipped)}>Flip</Button>
      </div>
    </div>
  )
}
