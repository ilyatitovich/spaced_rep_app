import Card from '@/components/card'
import CardToolbar from '@/components/ui/card-toolbar'
import type { Topic } from '@/models/topic.model'
import type { useDraftCard } from '@ext/hooks/use-draft-card'
import TopicPicker from './topic-picker'
import Button from '@/components/ui/button'

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
