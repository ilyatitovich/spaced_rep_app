import { Check, ChevronDown, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'

import { TITLE_MAX_LENGTH } from '@/lib/constants'
import type { Topic } from '@/models/topic.model'
import Dropdown from './dropdown'

const ITEM_CLASS =
  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted'

export default function TopicPicker({
  topics,
  selectedId,
  pageTitle,
  onSelect,
  onCreate
}: {
  topics: Topic[]
  selectedId: string
  pageTitle: string
  onSelect: (id: string) => void
  onCreate: (title: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const selected = topics.find(topic => topic.id === selectedId)
  const items = [...new Map(topics.map(t => [t.id, t])).values()].sort(
    (a, b) => b.updatedAt - a.updatedAt
  )

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setIsCreating(false)
  }, [])

  const handleCreate = () => {
    const next = title.trim()
    if (!next) return
    onCreate(next)
    handleClose()
  }

  return (
    <Dropdown
      isOpen={isOpen}
      onClose={handleClose}
      trigger={
        <button
          type="button"
          className="min-w-0 max-w-44 bg-background-secondary rounded-lg px-2 py-1 text-sm flex items-center gap-1"
          onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        >
          <span className="truncate">{selected?.title ?? 'Topic'}</span>
          <ChevronDown size={14} className="shrink-0" />
        </button>
      }
    >
      {items.map(topic => (
        <button
          key={topic.id}
          type="button"
          role="menuitem"
          className={ITEM_CLASS}
          onClick={() => {
            onSelect(topic.id)
            handleClose()
          }}
        >
          <span className="min-w-0 flex-1 truncate">{topic.title}</span>
          {topic.id === selectedId && (
            <Check size={14} className="shrink-0 text-success" />
          )}
        </button>
      ))}
      {isCreating ? (
        <input
          autoFocus
          className="w-full rounded-lg px-2 py-1.5 text-sm bg-background"
          maxLength={TITLE_MAX_LENGTH}
          value={title}
          onChange={event => setTitle(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') handleCreate()
          }}
        />
      ) : (
        <button
          type="button"
          role="menuitem"
          className={ITEM_CLASS}
          onClick={() => {
            setTitle(pageTitle.slice(0, TITLE_MAX_LENGTH))
            setIsCreating(true)
          }}
        >
          <Plus size={14} className="shrink-0" />
          New topic
        </button>
      )}
    </Dropdown>
  )
}
