import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { toast } from 'react-hot-toast'

import {
  Button,
  Card,
  Screen,
  CardToolbar,
  CardContainer,
  BackButton,
  Header
} from '@/components'
import {
  appendSideBlocks,
  isCardDataEqual,
  normalizeCardData
} from '@/lib'
import { Card as CardModel } from '@/models'
import { updateCard } from '@/services'
import type {
  CardData,
  CardHandle,
  SideBlock,
  SideName
} from '@/types'

type CardDetailsScreenProps = {
  isOpen: boolean
  cards: CardModel[] | null | undefined
  cardId: string | null | undefined
}

const SWIPE_THRESHOLD_PX = 60
const DRAG_CAPTURE_PX = 8
const ANIMATION_MS = 250

const isCarouselControl = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest('button, label, input, select, audio, textarea, a')

const mod = (n: number, m: number) => ((n % m) + m) % m

const getCardData = (card: CardModel | null | undefined): CardData =>
  normalizeCardData(card?.data)

const mergeTextFromEditor = (base: CardData, editor: CardData): CardData => ({
  front: {
    side: 'front',
    blocks: editor.front.blocks.length ? editor.front.blocks : base.front.blocks
  },
  back: {
    side: 'back',
    blocks: editor.back.blocks.length ? editor.back.blocks : base.back.blocks
  }
})

export default function CardDetailsScreen({
  isOpen,
  cards,
  cardId
}: CardDetailsScreenProps) {
  const total = cards?.length ?? 0

  const cardIndex = cards?.findIndex(card => card.id === cardId) ?? 0
  const [currentIndex, setCurrentIndex] = useState(cardIndex)
  const card = cards?.[currentIndex]

  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState<CardData>(() => getCardData(card))
  const [isEdited, setIsEdited] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const cardRef = useRef<CardHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const cardDataRef = useRef(cardData)
  const savedCardDataRef = useRef(getCardData(card))

  cardDataRef.current = cardData

  const isDragging = useRef(false)
  const isAnimating = useRef(false)
  const dragStartX = useRef(0)
  const dragStartY = useRef(0)

  const side = isFlipped ? 'back' : 'front'
  const prevIndex = total > 0 ? mod(currentIndex - 1, total) : 0
  const nextIndex = total > 0 ? mod(currentIndex + 1, total) : 0
  const prevCard = cards?.[prevIndex]
  const nextCard = cards?.[nextIndex]

  const setDirtyFrom = useCallback((data: CardData) => {
    setIsDirty(!isCardDataEqual(data, savedCardDataRef.current))
  }, [])

  const loadCardAtIndex = useCallback(
    (index: number) => {
      const c = cards?.[index]
      const data = getCardData(c)
      setCardData(data)
      cardDataRef.current = data
      savedCardDataRef.current = data
      setIsFlipped(false)
      setIsEdited(false)
      setIsDirty(false)
    },
    [cards]
  )

  const saveCard = useCallback(
    async (
      cardToSave: CardModel | undefined,
      dataToSave: CardData
    ): Promise<boolean> => {
      if (!cardToSave) return false

      try {
        cardToSave.data = dataToSave
        await updateCard(cardToSave)
        toast.success('Card updated!')
        return true
      } catch (error) {
        console.error('Failed to save card:', error)
        return false
      }
    },
    []
  )

  const readLatestCardData = useCallback((): CardData => {
    const editor = cardRef.current?.getContent()
    if (!editor) return cardDataRef.current
    return mergeTextFromEditor(cardDataRef.current, editor)
  }, [])

  const handleSaveCard = async (): Promise<void> => {
    const latest = readLatestCardData()
    const saved = await saveCard(card, latest)
    if (!saved) return

    setCardData(latest)
    cardDataRef.current = latest
    savedCardDataRef.current = latest
    setIsDirty(false)
    setIsEdited(false)
  }

  const snapTrackToCenter = useCallback(() => {
    const container = containerRef.current
    const track = trackRef.current
    const width = container?.offsetWidth ?? 0
    if (!track) return
    if (container) container.scrollLeft = 0
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
    snapTrackToCenter()
  }, [cardIndex, loadCardAtIndex, snapTrackToCenter])

  const handleBlur = (): void => {
    const latest = readLatestCardData()
    setCardData(latest)
    cardDataRef.current = latest
    setDirtyFrom(latest)
    setIsEdited(false)
  }

  const appendBlocks = (blocks: SideBlock[]) => {
    const latest = readLatestCardData()
    const next: CardData = {
      ...latest,
      [side]: {
        ...latest[side],
        blocks: appendSideBlocks(latest[side].blocks, blocks)
      }
    }
    cardDataRef.current = next
    setDirtyFrom(next)
    setCardData(next)
  }

  const handleChangeBlocks = (blocks: SideBlock[], sideName: SideName) => {
    setCardData(prev => {
      const next = {
        ...prev,
        [sideName]: { ...prev[sideName], blocks }
      }
      cardDataRef.current = next
      setDirtyFrom(next)
      return next
    })
  }

  const finishSwipe = useCallback(
    (direction: 1 | -1) => {
      if (total < 2) return

      if (isEdited) {
        const latest = readLatestCardData()
        void saveCard(card, latest)
      }

      const newIndex = mod(currentIndex + direction, total)
      setCurrentIndex(newIndex)
      loadCardAtIndex(newIndex)
    },
    [
      total,
      isEdited,
      card,
      saveCard,
      currentIndex,
      loadCardAtIndex,
      readLatestCardData
    ]
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
    if (isCarouselControl(e.target)) return
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartY.current = e.clientY
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

    const container = containerRef.current
    const track = trackRef.current
    const width = container?.offsetWidth ?? 0
    if (
      container &&
      Math.abs(deltaX) > DRAG_CAPTURE_PX &&
      !container.hasPointerCapture(e.pointerId)
    ) {
      container.setPointerCapture(e.pointerId)
    }
    if (track) {
      track.style.transition = 'none'
      track.style.transform = `translateX(${-width + deltaX}px)`
    }
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    isDragging.current = false

    const deltaX = e.clientX - dragStartX.current
    const container = containerRef.current
    const didDrag = container?.hasPointerCapture(e.pointerId) ?? false
    if (didDrag) container?.releasePointerCapture(e.pointerId)

    if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
      const direction: 1 | -1 = deltaX < 0 ? 1 : -1
      isAnimating.current = true
      animateTrackTo(direction === 1 ? 'next' : 'prev', () => {
        finishSwipe(direction)
      })
      return
    }

    if (didDrag) {
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
        <Button key="save" disabled={!isDirty} onClick={() => handleSaveCard()}>
          Save
        </Button>
      </Header>

      <div
        ref={containerRef}
        className="overflow-clip"
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
          <div
            style={{ flex: '0 0 33.3333%', pointerEvents: 'none' }}
            aria-hidden
          >
            <CardContainer>
              <Card data={getCardData(prevCard)} isFlipped={false} isEditable />
            </CardContainer>
          </div>

          <div style={{ flex: '0 0 33.3333%' }}>
            <CardContainer>
              <Card
                key={card?.id ?? currentIndex}
                ref={cardRef}
                data={cardData}
                isFlipped={isFlipped}
                isEditable={true}
                handleFocus={() => setIsEdited(true)}
                handleBlur={handleBlur}
                handleChange={handleChangeBlocks}
              />
            </CardContainer>
          </div>

          <div
            style={{ flex: '0 0 33.3333%', pointerEvents: 'none' }}
            aria-hidden
          >
            <CardContainer>
              <Card data={getCardData(nextCard)} isFlipped={false} isEditable />
            </CardContainer>
          </div>
        </div>
      </div>

      <CardToolbar
        isTextDisabled={cardData[side].blocks.at(-1)?.type === 'text'}
        onAddBlocks={appendBlocks}
        onFocusLast={() => cardRef.current?.focusContent(side, 'last')}
        onFlip={() => setIsFlipped(prev => !prev)}
      />
    </Screen>
  )
}
