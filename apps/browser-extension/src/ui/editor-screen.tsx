import { Camera, List, MousePointer2 } from 'lucide-react'

import Card from '@/components/card'
import CardToolbar from '@/components/ui/card-toolbar'
import type { Topic } from '@/models/topic.model'
import type { useDraftCard } from '@ext/hooks/use-draft-card'
import TopicPicker from './topic-picker'

type EditorScreenProps = {
  draft: ReturnType<typeof useDraftCard>
  topics: Topic[]
  selectedId: string
  pageTitle: string
  onSelectTopic: (id: string) => void
  onCreateTopic: (title: string) => void
  onRenameTopic: (title: string) => void
  onShowCards: () => void
}

export default function EditorScreen({
  draft,
  topics,
  selectedId,
  pageTitle,
  onSelectTopic,
  onCreateTopic,
  onRenameTopic,
  onShowCards
}: EditorScreenProps) {
  return (
    <>
      <header className="h-14 px-3 border-b border-border flex items-center justify-between gap-2">
        <button
          className="text-sm font-medium min-w-12"
          onClick={draft.flip}
        >
          {draft.isFlipped ? 'Back' : 'Front'}
        </button>
        <TopicPicker
          topics={topics}
          selectedId={selectedId}
          pageTitle={pageTitle}
          onSelect={onSelectTopic}
          onCreate={onCreateTopic}
          onRename={onRenameTopic}
        />
        <button
          className="text-primary font-semibold text-sm disabled:opacity-40"
          disabled={draft.busy || draft.isEmpty}
          onClick={() => void draft.save()}
        >
          {draft.isDraft ? 'Save draft' : 'Save'}
        </button>
        <button title="Cards" onClick={onShowCards}>
          <List size={17} />
        </button>
      </header>
      <section className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <Card
          ref={draft.cardRef}
          data={draft.card}
          isFlipped={draft.isFlipped}
          isEditable
          autoFocus
          handleChange={draft.handleChange}
        />
      </section>
      <div className="px-3">
        <CardToolbar
          isTextDisabled={draft.card[draft.side].blocks.at(-1)?.type === 'text'}
          onAddBlocks={draft.appendBlocks}
          onFocusLast={() =>
            draft.cardRef.current?.focusContent(draft.side, 'last')
          }
          onFlip={draft.flip}
        />
        <div className="grid grid-cols-2 gap-2 py-2">
          <button
            className="border border-border rounded-lg py-2 text-sm flex items-center justify-center gap-2"
            onClick={draft.captureSelection}
          >
            <MousePointer2 size={17} /> Selection
          </button>
          <button
            className="border border-border rounded-lg py-2 text-sm flex items-center justify-center gap-2"
            onClick={draft.captureScreenshot}
          >
            <Camera size={17} /> Screenshot
          </button>
        </div>
      </div>
    </>
  )
}
