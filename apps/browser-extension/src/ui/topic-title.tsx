import { useState } from 'react'

import { TITLE_MAX_LENGTH } from '@/lib/constants'

export default function TopicTitle({
  title,
  onCommit
}: {
  title: string
  onCommit: (title: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const isEditing = draft !== null
  const value = draft ?? title

  const commit = () => {
    const next = value.trim().slice(0, TITLE_MAX_LENGTH)
    setDraft(null)
    if (next && next !== title) onCommit(next)
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        className="min-w-0 truncate text-sm"
        onClick={() => setDraft(title)}
      >
        {title || 'Topic'}
      </button>
    )
  }

  return (
    <input
      autoFocus
      className="min-w-0 w-24 bg-transparent text-sm outline-none"
      maxLength={TITLE_MAX_LENGTH}
      value={value}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') setDraft(null)
      }}
    />
  )
}
