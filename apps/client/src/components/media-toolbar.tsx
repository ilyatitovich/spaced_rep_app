import type { ReactNode } from 'react'
import { SquarePen, Trash2 } from 'lucide-react'

type MediaToolbarProps = {
  removeLabel: string
  changeLabel: string
  onRemove: () => void
  children: ReactNode
}

export default function MediaToolbar({
  removeLabel,
  changeLabel,
  onRemove,
  children
}: MediaToolbarProps) {
  return (
    <div className="flex w-full items-center justify-between">
      <button
        type="button"
        className="p-1"
        aria-label={removeLabel}
        onClick={onRemove}
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <label className="p-1 cursor-pointer">
        <span className="sr-only">{changeLabel}</span>
        <SquarePen className="w-4 h-4" />
        {children}
      </label>
    </div>
  )
}
