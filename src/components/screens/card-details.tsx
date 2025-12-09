import { useState, useRef, useCallback, memo } from 'react'
import { toast } from 'react-hot-toast'

import {
  Button,
  Card,
  Screen,
  CardButton,
  CardContainer,
  BackButton,
  Header
} from '@/components'
import { isContentEmpty } from '@/lib'
import { useScreenStore, useTopicStore } from '@/stores'
import type {
  CardData,
  CardHandle,
  SideContent,
  SideContentType,
  SideName
} from '@/types'

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

export default memo(function CardDetailsScreen() {
  const card = useTopicStore(s => s.editCard)
  const isOpen = useScreenStore(s => s.isCardDetailsOpen)

  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState<CardData>({
    front: {
      side: 'front',
      content: card?.data.front.content ?? '',
      type: card?.data.front.type ?? 'text'
    },
    back: {
      side: 'back',
      content: card?.data.back.content ?? '',
      type: card?.data.back.type ?? 'text'
    }
  })
  const [isEdited, setIsEdited] = useState(false)
  // const [isNewCardData, setIsNewCardData] = useState(false)

  const [sidesContentType, setSidesContentType] = useState({
    front: card?.data.front.type ?? 'text',
    back: card?.data.back.type ?? 'text'
  })

  const cardRef = useRef<CardHandle>(null)

  const side = isFlipped ? 'back' : 'front'

  const rightBtn = isEdited ? (
    <Button key="done" onClick={() => setIsEdited(false)}>
      Done
    </Button>
  ) : (
    <Button
      key="save"
      onClick={() => handleSaveCard()}
      // disabled={!isNewCardData}
    >
      Save
    </Button>
  )

  const handleSaveCard = async (): Promise<void> => {
    try {
      if (!card) return

      card.data = cardData

      if (
        card.level === 0 &&
        !isContentEmpty(cardData.front.content) &&
        !isContentEmpty(cardData.back.content)
      ) {
        card.level += 1
      }

      await useTopicStore.getState().updateCard(card)
      setIsEdited(false)

      // setIsNewCardData(false)

      if (card.level > 0) {
        toast.success('Card updated!')
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
    setCardData(initialCardData)
    setSidesContentType(initialSidesContentType)
    cardRef.current?.resetContent()
  }, [isEdited])

  const handleOpen = useCallback(() => {
    setCardData({
      front: {
        side: 'front',
        content: card?.data.front.content ?? '',
        type: card?.data.front.type ?? 'text'
      },
      back: {
        side: 'back',
        content: card?.data.back.content ?? '',
        type: card?.data.back.type ?? 'text'
      }
    })

    setSidesContentType({
      front: card?.data.front.type ?? 'text',
      back: card?.data.back.type ?? 'text'
    })
  }, [card])

  const handleBlur = (): void => {
    if (cardRef.current) {
      const data = cardRef.current.getContent()

      // if (front !== card?.data.front || back !== card?.data.back) {
      //   setIsNewCardData(true)
      // } else {
      //   setIsNewCardData(false)
      // }

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
        cardRef.current?.focusContent(side)
      })
    }
  }

  const handleChangeSideContent = (value: SideContent, side: SideName) => {
    setCardData(prev => ({
      ...prev,
      [side]: {
        ...prev[side],
        content: value
      }
    }))
  }

  return (
    <Screen
      isOpen={isOpen}
      onClose={handleClose}
      onOpen={handleOpen}
      isVertical
    >
      <Header>
        <BackButton />
        <span>{isFlipped ? 'Back' : 'Front'}</span>
        {rightBtn}
      </Header>

      <CardContainer>
        <Card
          ref={cardRef}
          data={cardData}
          sidesContentType={sidesContentType}
          isFlipped={isFlipped}
          isEditable={true}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
          handleChange={handleChangeSideContent}
        />
      </CardContainer>

      {/* Buttons */}
      <div className="pt-1 flex justify-center items-center gap-10">
        <CardButton
          type="text"
          onClick={() => handleChangeSideContentType('text')}
          isDisabled={sidesContentType[side] === 'text'}
        />
        <CardButton
          type="image"
          onClick={() => handleChangeSideContentType('image')}
          isDisabled={sidesContentType[side] === 'image'}
        />
        <CardButton
          type="code"
          onClick={() => handleChangeSideContentType('code')}
          isDisabled={sidesContentType[side] === 'code'}
        />
        <CardButton type="flip" onClick={() => setIsFlipped(prev => !prev)} />
      </div>
    </Screen>
  )
})
