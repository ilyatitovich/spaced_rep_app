import { useRef, useState, type ChangeEvent } from 'react'

import {
  Button,
  Card,
  BackButton,
  CardButton,
  CardContainer,
  Screen,
  Header
} from '@/components'
import {
  appendSideBlocks,
  blobToRecord,
  isSideEmpty,
  processImage,
  type CodeLang
} from '@/lib'
import { Card as CardModel } from '@/models'
import { createCard } from '@/services'
import type {
  CardData,
  CardHandle,
  MediaDBRecord,
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
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

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

  const handleAddText = () => {
    appendBlocks([{ type: 'text', html: '' }])
    requestAnimationFrame(() => {
      currentCardRef.current?.focusContent(side, 'last')
    })
  }

  const handleAddCode = (lang: CodeLang) => {
    appendBlocks([{ type: 'code', lang, code: '' }])
  }

  const handleSelectMedia = (kind: 'image' | 'audio') => {
    if (kind === 'image') imageInputRef.current?.click()
    else audioInputRef.current?.click()
  }

  const handlePickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const webp = await processImage(file)
      const record = await blobToRecord(webp)
      appendBlocks([{ type: 'image', content: record }])
    } catch (err) {
      console.error('Failed to add image:', err)
    }
  }

  const handlePickAudio = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const content: MediaDBRecord = { buffer, type: file.type || 'audio/mpeg' }
      appendBlocks([{ type: 'audio', content }])
    } catch (err) {
      console.error('Failed to add audio:', err)
    }
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
      <div className="pt-1 flex justify-center items-center gap-10">
        <CardButton
          type="text"
          isDisabled={cardData[side].blocks.at(-1)?.type === 'text'}
          onClick={handleAddText}
        />
        <CardButton type="media" onSelectMedia={handleSelectMedia} />
        <CardButton type="code" onSelectCode={handleAddCode} />
        <CardButton type="flip" onClick={() => setIsFlipped(prev => !prev)} />
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePickImage}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handlePickAudio}
      />
    </Screen>
  )
}
