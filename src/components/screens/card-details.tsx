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
import type { CardData, CardHandle, SideContentType, SideName } from '@/types'

type CardDetailsScreen = {
  isOpen: boolean
  card: CardModel | null | undefined
  onUpdate?: (card: CardModel) => void
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

export default function CardDetailsScreen({
  isOpen,
  card,
  onUpdate
}: CardDetailsScreen) {
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

      if (card.level === 0 && cardData.front && cardData.back) {
        card.level += 1
      }

      await updateCard(card)
      setIsEdited(false)
      onUpdate?.(card)
      // setIsNewCardData(false)

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
  }, [card])

  const handleBlur = (): void => {
    // if (cardRef.current) {
    //   const { front, back } = cardRef.current.getContent()

    //   // if (front !== card?.data.front || back !== card?.data.back) {
    //   //   setIsNewCardData(true)
    //   // } else {
    //   //   setIsNewCardData(false)
    //   // }
    // }
    setIsEdited(false)
  }

  const handleChangeSideContentType = (type: SideContentType = 'text') => {
    const side = isFlipped ? 'back' : 'front'

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

  const handleChangeSideContent = (value: string | Blob, side: SideName) => {
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
          sidesContentType={sidesContentType}
          isFlipped={isFlipped}
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
