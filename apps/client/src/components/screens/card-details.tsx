import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence } from 'motion/react'
import { useSearchParams } from 'react-router'
import { toast } from 'react-hot-toast'

import {
  Button,
  Card,
  CardButton,
  Screen,
  CardToolbar,
  CardContainer,
  BackButton,
  Header,
  SelectionModeFooter
} from '@/components'
import {
  appendSideBlocks,
  isCardDataEqual,
  normalizeCardData,
  removeLastSearchParam
} from '@/lib'
import { Card as CardModel } from '@/models'
import { deleteCardsBulk, updateCard, updateCardsLevelBulk } from '@/services'
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
  onDeleteCards: (remaining: CardModel[]) => void
  onMoveCards: (
    remaining: CardModel[],
    moved: CardModel[],
    toLevel: number
  ) => void
}

const SWIPE_THRESHOLD_PX = 60
const DRAG_CAPTURE_PX = 8
const ANIMATION_MS = 250

const isCarouselControl = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest(
    'button, label, input, select, audio, textarea, a, [role="slider"]'
  )

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
  cardId,
  onDeleteCards,
  onMoveCards
}: CardDetailsScreenProps) {
  const [, setSearchParams] = useSearchParams()
  const total = cards?.length ?? 0

  const cardIndex = Math.max(0, cards?.findIndex(card => card.id === cardId) ?? 0)
  const [currentIndex, setCurrentIndex] = useState(cardIndex)
  const card = cards?.[currentIndex]

  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState<CardData>(() => getCardData(card))
  const [isEditable, setIsEditable] = useState(false)
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
  const lastDeltaX = useRef(0)
  const detachTouch = useRef<(() => void) | null>(null)

  const side = isFlipped ? 'back' : 'front'
  const prevIndex = total > 0 ? mod(currentIndex - 1, total) : 0
  const nextIndex = total > 0 ? mod(currentIndex + 1, total) : 0
  const prevCard = cards?.[prevIndex]
  const nextCard = cards?.[nextIndex]

  const setDirtyFrom = useCallback((data: CardData) => {
    setIsDirty(!isCardDataEqual(data, savedCardDataRef.current))
  }, [])

  const loadCardAtIndex = useCallback(
    (index: number, list = cards) => {
      const c = list?.[index]
      const data = getCardData(c)
      setCardData(data)
      cardDataRef.current = data
      savedCardDataRef.current = data
      setIsFlipped(false)
      setIsEditable(false)
      setIsEdited(false)
      setIsDirty(false)
    },
    [cards]
  )

  const showNextOrClose = (remaining: CardModel[]) => {
    if (remaining.length === 0) {
      setSearchParams(prev => removeLastSearchParam(prev))
      return
    }
    const nextIndex = Math.min(currentIndex, remaining.length - 1)
    setCurrentIndex(nextIndex)
    loadCardAtIndex(nextIndex, remaining)
  }

  const handleDeleteCard = async (): Promise<void> => {
    if (!card) return
    try {
      await deleteCardsBulk([card.id])
      const remaining = (cards ?? []).filter(item => item.id !== card.id)
      onDeleteCards(remaining)
      showNextOrClose(remaining)
    } catch (error) {
      console.error('Failed to delete card:', error)
    }
  }

  const handleMoveCard = async (toLevel: number): Promise<void> => {
    if (!card) return
    try {
      await updateCardsLevelBulk([card], toLevel)
      const remaining = (cards ?? []).filter(item => item.id !== card.id)
      onMoveCards(remaining, [card], toLevel)
      showNextOrClose(remaining)
    } catch (error) {
      console.error('Failed to move card:', error)
    }
  }

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
    if (isDirty) {
      const saved = await saveCard(card, latest)
      if (!saved) return

      setCardData(latest)
      cardDataRef.current = latest
      savedCardDataRef.current = latest
    }
    setIsDirty(false)
    setIsEdited(false)
    setIsEditable(false)
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

  const clearTouchListeners = () => {
    detachTouch.current?.()
    detachTouch.current = null
  }

  const applyDrag = (clientX: number, clientY: number) => {
    if (!isDragging.current) return

    const deltaX = clientX - dragStartX.current
    const deltaY = clientY - dragStartY.current

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      isDragging.current = false
      clearTouchListeners()
      animateTrackTo('center')
      return
    }

    lastDeltaX.current = deltaX
    const track = trackRef.current
    const width = containerRef.current?.offsetWidth ?? 0
    if (track) {
      track.style.transition = 'none'
      track.style.transform = `translateX(${-width + deltaX}px)`
    }
  }

  const endDrag = () => {
    if (!isDragging.current) return
    isDragging.current = false
    clearTouchListeners()

    const deltaX = lastDeltaX.current
    const didDrag = Math.abs(deltaX) > DRAG_CAPTURE_PX

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

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isEditable || isAnimating.current || total < 2) return
    if (isCarouselControl(e.target)) return
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartY.current = e.clientY
    lastDeltaX.current = 0

    const onTouchMove = (te: TouchEvent) => {
      if (!isDragging.current) return
      const t = te.touches[0]
      if (!t) return
      const deltaX = t.clientX - dragStartX.current
      const deltaY = t.clientY - dragStartY.current
      const isVertical =
        Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10
      if (!isVertical && te.cancelable) te.preventDefault()
      applyDrag(t.clientX, t.clientY)
    }
    const onTouchEnd = (te: TouchEvent) => {
      const t = te.changedTouches[0]
      if (t) lastDeltaX.current = t.clientX - dragStartX.current
      endDrag()
    }
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    detachTouch.current = () => {
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    applyDrag(e.clientX, e.clientY)
  }

  const handlePointerUp = () => {
    endDrag()
  }

  const handlePointerCancel = () => {
    if (!detachTouch.current) endDrag()
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
        {isEditable ? (
          <Button key="save" onClick={() => handleSaveCard()}>
            Save
          </Button>
        ) : (
          <Button key="edit" onClick={() => setIsEditable(true)}>
            Edit
          </Button>
        )}
      </Header>

      <div
        ref={containerRef}
        className="overflow-clip"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
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
              <Card data={getCardData(prevCard)} isFlipped={false} />
            </CardContainer>
          </div>

          <div style={{ flex: '0 0 33.3333%' }}>
            <CardContainer>
              <Card
                key={card?.id ?? currentIndex}
                ref={cardRef}
                data={cardData}
                isFlipped={isFlipped}
                isEditable={isEditable}
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
              <Card data={getCardData(nextCard)} isFlipped={false} />
            </CardContainer>
          </div>
        </div>
      </div>

      {isEditable ? (
        <CardToolbar
          isTextDisabled={cardData[side].blocks.at(-1)?.type === 'text'}
          onAddBlocks={appendBlocks}
          onFocusLast={() => cardRef.current?.focusContent(side, 'last')}
          onFlip={() => setIsFlipped(prev => !prev)}
        />
      ) : (
        <div className="pt-1 pb-20 flex justify-center items-center">
          <CardButton
            type="flip"
            onClick={() => setIsFlipped(prev => !prev)}
          />
        </div>
      )}

      <AnimatePresence>
        {!isEditable && (
          <SelectionModeFooter
            countItemsForDelete={card ? 1 : 0}
            nameItemsForDelete="card"
            handleDelete={handleDeleteCard}
            handleMove={handleMoveCard}
            currentLevel={card?.level ?? 0}
          />
        )}
      </AnimatePresence>
    </Screen>
  )
}
