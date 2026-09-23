import { useEffect, useRef, useState } from 'react'

import Card from '@/components/card'
import Button from '@/components/ui/button'
import CardToolbar from '@/components/ui/card-toolbar'
import CardContainer from '@/components/wrappers/card-container'
import type { CardHandle } from '@/types'
import { emptyCardData } from '@ext/lib/card-codec'
import type { Topic } from '@/models/topic.model'
import type { useDraftCard } from '@ext/hooks/use-draft-card'
import TopicPicker from '../ui/topic-picker'

const blankCardTemplate = emptyCardData()

interface EditorScreenProps {
  draft: ReturnType<typeof useDraftCard>
  topics: Topic[]
  selectedId: string
  pageTitle: string
  onSelectTopic: (id: string) => void
  onCreateTopic: (title: string) => void
  onRenameTopic: (title: string) => void
}

export default function EditorScreen({
  draft,
  topics,
  selectedId,
  pageTitle,
  onSelectTopic,
  onCreateTopic,
  onRenameTopic
}: EditorScreenProps) {
  const [isFirstCardActive, setIsFirstCardActive] = useState(true)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const secondCardRef = useRef<CardHandle>(null)
  const {
    card: cardData,
    cardRef: currentCardRef,
    isFlipped,
    handleChange
  } = draft

  useEffect(() => {
    const onCardAdvanced = draft.onCardAdvancedRef
    onCardAdvanced.current = () => {
      setIsFirstCardActive(prev => !prev)
      setIsInitialRender(false)
    }
    return () => {
      onCardAdvanced.current = null
    }
  }, [draft.onCardAdvancedRef])

  return (
    <>
      <div className="h-14 px-3 border-b border-border flex items-center justify-between gap-2 relative">
        <TopicPicker
          topics={topics}
          selectedId={selectedId}
          pageTitle={pageTitle}
          onSelect={onSelectTopic}
          onCreate={onCreateTopic}
          onRename={onRenameTopic}
        />

        <span className="text-sm font-medium min-w-12 absolute left-1/2 -translate-x-1/2">
          {draft.isFlipped ? 'Back' : 'Front'}
        </span>

        <Button
          variant="ghost"
          className="text-sm"
          disabled={draft.busy || draft.isEmpty}
          onClick={() => void draft.save()}
        >
          {draft.isDraft ? 'Save draft' : 'Save'}
        </Button>
      </div>
      <CardContainer>
        <Card
          ref={isFirstCardActive ? currentCardRef : secondCardRef}
          className={isFirstCardActive ? 'scale-up' : 'move-right'}
          data={isFirstCardActive ? cardData : blankCardTemplate}
          isFlipped={isFirstCardActive ? isFlipped : false}
          isEditable
          autoFocus={isFirstCardActive}
          handleChange={handleChange}
        />
        <Card
          ref={isFirstCardActive ? secondCardRef : currentCardRef}
          className={`${isInitialRender ? 'hidden' : ''} ${isFirstCardActive ? 'move-right' : 'scale-up'}`.trim()}
          data={isFirstCardActive ? blankCardTemplate : cardData}
          isFlipped={isFirstCardActive ? false : isFlipped}
          isEditable
          autoFocus={!isFirstCardActive}
          handleChange={handleChange}
        />
      </CardContainer>
      <div className="pb-6">
        <CardToolbar
          isTextDisabled={draft.card[draft.side].blocks.at(-1)?.type === 'text'}
          onAddBlocks={draft.appendBlocks}
          onFocusLast={() =>
            draft.cardRef.current?.focusContent(draft.side, 'last')
          }
          onFlip={draft.flip}
        />
      </div>
    </>
  )
}
