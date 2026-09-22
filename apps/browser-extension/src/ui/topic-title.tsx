import { useEffect, useState } from 'react'

import { TITLE_MAX_LENGTH } from '@/lib/constants'

export default function TopicTitle({
  title,
  onCommit
}: {
  title: string
  onCommit: (title: string) => void
}) {
  const [value, setValue] = useState(title)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!isEditing) setValue(title)
  }, [title, isEditing])

  const commit = () => {
    setIsEditing(false)
    const next = value.trim().slice(0, TITLE_MAX_LENGTH)
    if (next && next !== title) onCommit(next)
    else setValue(title)
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        className="min-w-0 truncate text-sm"
        onClick={() => setIsEditing(true)}
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
      onChange={event => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') {
          setValue(title)
          setIsEditing(false)
        }
      }}
    />
  )
}
