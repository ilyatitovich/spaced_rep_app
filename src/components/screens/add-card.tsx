import { useState, useRef } from 'react'

import {
  Button,
  Card,
  BackButton,
  CardButton,
  CardContainer,
  Screen,
  Header
} from '@/components'
import { isContentEmpty } from '@/lib'
import { Card as CardModel } from '@/models'
import { createCard } from '@/services'
import type { CardHandle, CardData, SideContentType, SideName } from '@/types'

type NewCardPageProps = {
  isOpen: boolean
  topicId: string
  onAdd: (payload: { level: number; card: CardModel }) => void
}

const initialCardData: CardData = {
  front: { side: 'front', type: 'text', content: '' },
  back: { side: 'back', type: 'text', content: '' }
}

const initialSidesContentType: {
  front: SideContentType
  back: SideContentType
} = {
  front: 'text',
  back: 'text'
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

  const [sidesContentType, setSidesContentType] = useState(
    initialSidesContentType
  )

  const currentCardRef = useRef<CardHandle>(null)
  const secondCardRef = useRef<CardHandle>(null)

  const side = isFlipped ? 'back' : 'front'

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
        disabled={!cardData.front.content && !cardData.back.content}
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
      setSidesContentType(initialSidesContentType)
    } catch (error) {
      console.error('Failed to save card:', error)
    }
  }

  const handleBlur = (): void => {
    if (currentCardRef.current) {
      const data = currentCardRef.current.getContent()

      if (side === 'front') {
        if (
          isContentEmpty(data.front.content) ||
          isContentEmpty(cardData.back.content)
        ) {
          setIsDraft(true)
        }

        if (
          !isContentEmpty(data.front.content) &&
          !isContentEmpty(cardData.back.content)
        ) {
          setIsDraft(false)
        }
      }

      if (side === 'back') {
        if (
          isContentEmpty(data.back.content) ||
          isContentEmpty(cardData.front.content)
        ) {
          setIsDraft(true)
        }

        if (
          !isContentEmpty(data.back.content) &&
          !isContentEmpty(cardData.front.content)
        ) {
          setIsDraft(false)
        }
      }

      setCardData(prev => ({
        ...prev,
        [side]: {
          ...prev[side],
          content: data[side].content
        }
      }))
    }

    setIsEdited(false)
  }

  const handleChangeSideContentType = (type: SideContentType = 'text') => {
    setSidesContentType(prev => ({
      ...prev,
      [side]: type
    }))

    setCardData(prev => ({
      ...prev,
      [side]: {
        ...prev[side],
        type,
        content: ''
      }
    }))

    if (type === 'text') {
      requestAnimationFrame(() => {
        currentCardRef.current?.focusContent(side)
      })
    }
  }

  const handleChangeSideContent = (value: string | Blob, side: SideName) => {
    setCardData(prev => ({
      ...prev,
      [side]: {
        ...prev[side],
        content: value
      }
    }))

    if (value instanceof Blob) {
      if (
        (side === 'front' && !isContentEmpty(cardData.back.content)) ||
        (side === 'back' && !isContentEmpty(cardData.front.content))
      ) {
        setIsDraft(false)
      }
    }
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
    setSidesContentType(initialSidesContentType)
    currentCardRef.current?.resetContent()
    secondCardRef.current?.resetContent()
  }

  return (
    <Screen isOpen={isOpen} onClose={handleClose} isVertical>
      <Header>
        <BackButton />
        <span>{isFlipped ? 'Back' : 'Front'}</span>
        {rightBtn}
      </Header>
      <CardContainer>
        <Card
          ref={isFirstCardActive ? currentCardRef : secondCardRef}
          className={`${isFirstCardActive ? 'scale-up' : 'move-right'}`}
          data={isFirstCardActive ? initialCardData : cardData}
          sidesContentType={sidesContentType}
          isFlipped={isFirstCardActive ? isFlipped : false}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
          handleChange={handleChangeSideContent}
        />
        <Card
          ref={isFirstCardActive ? secondCardRef : currentCardRef}
          className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? 'move-right' : 'scale-up'}`.trim()}
          data={isFirstCardActive ? cardData : initialCardData}
          sidesContentType={sidesContentType}
          isFlipped={isFirstCardActive ? false : isFlipped}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
          handleChange={handleChangeSideContent}
        />
      </CardContainer>
      {/* Buttons */}
      <div className="pt-1 flex justify-center items-center gap-12">
        <CardButton
          type="text"
          onClick={() => handleChangeSideContentType('text')}
          isDisabled={sidesContentType[isFlipped ? 'back' : 'front'] === 'text'}
        />
        <CardButton
          type="image"
          onClick={() => handleChangeSideContentType('image')}
          isDisabled={
            sidesContentType[isFlipped ? 'back' : 'front'] === 'image'
          }
        />
        <CardButton type="flip" onClick={() => setIsFlipped(prev => !prev)} />
      </div>
    </Screen>
  )
}
