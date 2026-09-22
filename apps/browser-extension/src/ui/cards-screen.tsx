import { SquarePen } from 'lucide-react'
import { useState } from 'react'

import ConfirmDeleteModal from '@/components/modals/confirm-delete-modal'
import type { Topic } from '@/models/topic.model'
import type { Card } from '@ext/types'
import CardRow from './card-row'

type CardsScreenProps = {
  cards: Card[]
  topics: Topic[]
  onShowEditor: () => void
  onEdit: (card: Card) => void
  onDelete: (ids: string[]) => Promise<unknown> | unknown
}

export default function CardsScreen({
  cards,
  topics,
  onShowEditor,
  onEdit,
  onDelete
}: CardsScreenProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const titles = new Map(topics.map(topic => [topic.id, topic.title]))
  const topicIds = [
    ...new Set([
      ...topics.map(topic => topic.id),
      ...cards.map(card => card.topicId)
    ])
  ]

  return (
    <section className="flex-1 min-h-0 flex flex-col">
      <header className="h-14 px-3 border-b border-border flex items-center justify-between gap-2">
        <button title="Editor" onClick={onShowEditor}>
          <SquarePen size={17} />
        </button>
        <span className="text-sm font-medium">Cards</span>
        <span className="text-sm">{cards.length}</span>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-3">
        {topicIds.map(topicId => {
          const items = cards.filter(card => card.topicId === topicId)
          if (!items.length) return null
          return (
            <section key={topicId} className="py-3">
              <h2 className="text-xs font-medium text-foreground-muted mb-1">
                {titles.get(topicId) ?? 'Untitled'} ({items.length})
              </h2>
              {items.map(card => (
                <CardRow
                  key={card.id}
                  card={card}
                  onOpen={() => onEdit(card)}
                  onDelete={() => setPendingId(card.id)}
                />
              ))}
            </section>
          )
        })}
      </div>
      <ConfirmDeleteModal
        isOpen={pendingId !== null}
        count={1}
        itemName="card"
        onClose={() => setPendingId(null)}
        onConfirm={async () => {
          if (!pendingId) return
          await onDelete([pendingId])
        }}
      />
    </section>
  )
}
