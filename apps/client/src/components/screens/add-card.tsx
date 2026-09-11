import { useRef, useState } from 'react'

import {
  Button,
  Card,
  BackButton,
  CardToolbar,
  CardContainer,
  Screen,
  Header
} from '@/components'
import { appendSideBlocks, isSideEmpty } from '@/lib'
import { Card as CardModel } from '@/models'
import { createCard } from '@/services'
import type {
  CardData,
  CardHandle,
  SideBlock,
  SideName
} from '@/types'

type NewCardPageProps = {
  isOpen: boolean
  topicId: string
  onAdd: (payload: { level: number; card: CardModel }) => void
}

const emptySide = (side: SideName) => ({
  side,
  blocks: [{ type: 'text' as const, html: '' }]
})

const blankCardTemplate: CardData = {
  front: emptySide('front'),
  back: emptySide('back')
}

const createEmptyCardData = (): CardData => ({
  front: emptySide('front'),
  back: emptySide('back')
})

export default function AddCardScreen({
  isOpen,
  topicId,
  onAdd
}: NewCardPageProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState(createEmptyCardData)
  const [isEdited, setIsEdited] = useState(false)
  const [isDraft, setIsDraft] = useState(true)
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)

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
        disabled={isSideEmpty(cardData.front) && isSideEmpty(cardData.back)}
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

      const latest = currentCardRef.current?.getContent() ?? cardData
      const card = new CardModel(latest, topicId, cardStatus === 'new' ? 1 : 0)
      await createCard(card)
      onAdd({ level: card.level, card })
      setCardData(createEmptyCardData())
      setIsFlipped(false)
      setIsDraft(true)
      setIsFirstCardActive(prev => !prev)
      setIsInitialRender(false)
    } catch (error) {
      console.error('Failed to save card:', error)
    }
  }

  const handleBlur = (): void => {
    if (currentCardRef.current) {
      const data = currentCardRef.current.getContent()

      if (isSideEmpty(data.front) || isSideEmpty(data.back)) {
        setIsDraft(true)
      } else {
        setIsDraft(false)
      }

      setCardData(data)
    }

    setIsEdited(false)
  }

  const appendBlocks = (blocks: SideBlock[]) => {
    const latest = currentCardRef.current?.getContent() ?? cardData
    const next: CardData = {
      ...latest,
      [side]: {
        ...latest[side],
        blocks: appendSideBlocks(latest[side].blocks, blocks)
      }
    }
    if (
      (side === 'front' && !isSideEmpty(latest.back)) ||
      (side === 'back' && !isSideEmpty(latest.front))
    ) {
      setIsDraft(false)
    }
    setCardData(next)
  }

  const handleChangeBlocks = (blocks: SideBlock[], sideName: SideName) => {
    const other = sideName === 'front' ? 'back' : 'front'
    if (
      !isSideEmpty(cardData[other]) &&
      !isSideEmpty({ side: sideName, blocks })
    ) {
      setIsDraft(false)
    }

    setCardData(prev => ({
      ...prev,
      [sideName]: { ...prev[sideName], blocks }
    }))
  }

  const handleClose = (): void => {
    if (isEdited) {
      setIsEdited(false)
    }
    setCardData(createEmptyCardData())
    setIsFlipped(false)
    setIsDraft(true)
    setIsFirstCardActive(true)
    setIsInitialRender(true)
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
          data={isFirstCardActive ? cardData : blankCardTemplate}
          isFlipped={isFirstCardActive ? isFlipped : false}
          isEditable={true}
          autoFocus={isFirstCardActive}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
          handleChange={handleChangeBlocks}
        />
        <Card
          ref={isFirstCardActive ? secondCardRef : currentCardRef}
          className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? 'move-right' : 'scale-up'}`.trim()}
          data={isFirstCardActive ? blankCardTemplate : cardData}
          isFlipped={isFirstCardActive ? false : isFlipped}
          isEditable={true}
          autoFocus={!isFirstCardActive}
          handleFocus={() => setIsEdited(true)}
          handleBlur={handleBlur}
          handleChange={handleChangeBlocks}
        />
      </CardContainer>
      <CardToolbar
        isTextDisabled={cardData[side].blocks.at(-1)?.type === 'text'}
        onAddBlocks={appendBlocks}
        onFocusLast={() => currentCardRef.current?.focusContent(side, 'last')}
        onFlip={() => setIsFlipped(prev => !prev)}
      />
    </Screen>
  )
}
