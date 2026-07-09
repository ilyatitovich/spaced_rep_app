import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { toast } from 'react-hot-toast'
import type { PointerEvent as ReactPointerEvent } from 'react'

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
import { Card as CardModel } from '@/models'
import { updateCard } from '@/services'
import type {
  CardData,
  CardHandle,
  SideContent,
  SideContentType,
  SideName
} from '@/types'

type CardDetailsScreenProps = {
  isOpen: boolean
  cards: CardModel[] | null | undefined
  cardId: string | null | undefined
  onUpdate?: (card: CardModel) => void
}

const SWIPE_THRESHOLD_PX = 60
const ANIMATION_MS = 250

const mod = (n: number, m: number) => ((n % m) + m) % m

const getCardData = (card: CardModel | null | undefined): CardData => ({
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

const getSidesContentType = (card: CardModel | null | undefined) => ({
  front: card?.data.front.type ?? 'text',
  back: card?.data.back.type ?? 'text'
})

export default function CardDetailsScreen({
  isOpen,
  cards,
  cardId,
  onUpdate
}: CardDetailsScreenProps) {
  const total = cards?.length ?? 0

  const cardIndex = cards?.findIndex(card => card.id === cardId) ?? 0
  const [currentIndex, setCurrentIndex] = useState(cardIndex)
  const card = cards?.[currentIndex]

  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState<CardData>(() => getCardData(card))
  const [isEdited, setIsEdited] = useState(false)
  const [sidesContentType, setSidesContentType] = useState(() =>
    getSidesContentType(card)
  )

  const cardRef = useRef<CardHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const isDragging = useRef(false)
  const isAnimating = useRef(false)
  const dragStartX = useRef(0)
  const dragStartY = useRef(0)

  const side = isFlipped ? 'back' : 'front'
  const prevIndex = total > 0 ? mod(currentIndex - 1, total) : 0
  const nextIndex = total > 0 ? mod(currentIndex + 1, total) : 0
  const prevCard = cards?.[prevIndex]
  const nextCard = cards?.[nextIndex]

  const loadCardAtIndex = useCallback(
    (index: number) => {
      const c = cards?.[index]
      setCardData(getCardData(c))
      setSidesContentType(getSidesContentType(c))
      setIsFlipped(false)
      setIsEdited(false)
    },
    [cards]
  )

  const saveCard = useCallback(
    async (cardToSave: CardModel | undefined, dataToSave: CardData) => {
      if (!cardToSave) return

      try {
        cardToSave.data = dataToSave

        if (
          cardToSave.level === 0 &&
          !isContentEmpty(dataToSave.front.content) &&
          !isContentEmpty(dataToSave.back.content)
        ) {
          cardToSave.level += 1
          onUpdate?.(cardToSave)
        }

        await updateCard(cardToSave)

        if (cardToSave.level > 0) {
          toast.success('Card updated!')
        }
      } catch (error) {
        console.error('Failed to save card:', error)
      }
    },
    [onUpdate]
  )

  const handleSaveCard = async (): Promise<void> => {
    const latest = cardRef.current?.getContent() ?? cardData
    await saveCard(card, latest)
    setIsEdited(false)
  }

  const snapTrackToCenter = useCallback(() => {
    const track = trackRef.current
    const width = containerRef.current?.offsetWidth ?? 0
    if (!track) return
    track.style.transition = 'none'
    track.style.transform = `translateX(${-width}px)`
    void track.offsetHeight
    track.style.transition = ''
  }, [])

  useLayoutEffect(() => {
    snapTrackToCenter()
    isAnimating.current = false
  }, [currentIndex, snapTrackToCenter])

  const handleClose = useCallback(() => {
    setCurrentIndex(0)
    loadCardAtIndex(0)
  }, [loadCardAtIndex])

  const handleOpen = useCallback(() => {
    setCurrentIndex(cardIndex)
    loadCardAtIndex(cardIndex)
  }, [cardIndex, loadCardAtIndex])

  const handleBlur = (): void => {
    if (cardRef.current) {
      const data = cardRef.current.getContent()
      setCardData(prev => ({
        ...prev,
        [side]: { ...prev[side], content: data[side].content }
      }))
    }
    setIsEdited(false)
  }

  const handleChangeSideContentType = (type: SideContentType = 'text') => {
    setSidesContentType(prev => ({ ...prev, [side]: type }))
    setCardData(prev => ({
      ...prev,
      [side]: { ...prev[side], type, content: '' }
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
      [side]: { ...prev[side], content: value }
    }))
  }

  const finishSwipe = useCallback(
    (direction: 1 | -1) => {
      if (total < 2) return

      if (isEdited) {
        const latest = cardRef.current?.getContent() ?? cardData
        void saveCard(card, latest)
      }

      const newIndex = mod(currentIndex + direction, total)
      setCurrentIndex(newIndex)
      loadCardAtIndex(newIndex)
    },
    [total, isEdited, card, cardData, saveCard, currentIndex, loadCardAtIndex]
  )

  const animateTrackTo = useCallback(
    (target: 'next' | 'prev' | 'center', onDone?: () => void) => {
      const track = trackRef.current
      const width = containerRef.current?.offsetWidth ?? 0
      if (!track) return

      const targetPx =
        target === 'next' ? -2 * width : target === 'prev' ? 0 : -width

      track.style.transition = `transform ${ANIMATION_MS}ms ease`
      track.style.transform = `translateX(${targetPx}px)`

      const onTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName !== 'transform') return
        track.removeEventListener('transitionend', onTransitionEnd)
        onDone?.()
      }
      track.addEventListener('transitionend', onTransitionEnd)
    },
    []
  )

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isEdited || isAnimating.current || total < 2) return
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartY.current = e.clientY
    containerRef.current?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return

    const deltaX = e.clientX - dragStartX.current
    const deltaY = e.clientY - dragStartY.current

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      isDragging.current = false
      animateTrackTo('center')
      return
    }

    const width = containerRef.current?.offsetWidth ?? 0
    const track = trackRef.current
    if (track) {
      track.style.transition = 'none'
      track.style.transform = `translateX(${-width + deltaX}px)`
    }
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    isDragging.current = false

    const deltaX = e.clientX - dragStartX.current

    if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
      const direction: 1 | -1 = deltaX < 0 ? 1 : -1
      isAnimating.current = true
      animateTrackTo(direction === 1 ? 'next' : 'prev', () => {
        finishSwipe(direction)
      })
    } else {
      isAnimating.current = true
      animateTrackTo('center', () => {
        isAnimating.current = false
      })
    }
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
        {isEdited ? (
          <Button key="done" onClick={() => setIsEdited(false)}>
            Done
          </Button>
        ) : (
          <Button key="save" onClick={() => handleSaveCard()}>
            Save
          </Button>
        )}
      </Header>

      <div
        ref={containerRef}
        className="overflow-hidden"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={trackRef}
          className="flex"
          style={{ width: '300%', willChange: 'transform' }}
        >
          {/* Previous preview card */}
          <div
            style={{ flex: '0 0 33.3333%', pointerEvents: 'none' }}
            aria-hidden
          >
            <CardContainer>
              <Card
                data={getCardData(prevCard)}
                sidesContentType={getSidesContentType(prevCard)}
                isFlipped={false}
                isEditable={false}
                handleFocus={() => {}}
                handleBlur={() => {}}
                handleChange={() => {}}
              />
            </CardContainer>
          </div>

          {/* Current editable card */}
          <div style={{ flex: '0 0 33.3333%' }}>
            <CardContainer>
              <Card
                key={card?.id ?? currentIndex} // force re-render when card changes by index
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
          </div>

          {/* Next preview card */}
          <div
            style={{ flex: '0 0 33.3333%', pointerEvents: 'none' }}
            aria-hidden
          >
            <CardContainer>
              <Card
                data={getCardData(nextCard)}
                sidesContentType={getSidesContentType(nextCard)}
                isFlipped={false}
                isEditable={false}
                handleFocus={() => {}}
                handleBlur={() => {}}
                handleChange={() => {}}
              />
            </CardContainer>
          </div>
        </div>
      </div>

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
}
