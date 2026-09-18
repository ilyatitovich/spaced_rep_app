import type { ReactNode } from 'react'
import { Crop, SquarePen, Trash2 } from 'lucide-react'

import Button from '../ui/button'

type MediaToolbarProps = {
  removeLabel: string
  changeLabel: string
  onRemove: () => void
  editLabel?: string
  onEdit?: () => void
  children: ReactNode
}

export default function MediaToolbar({
  removeLabel,
  changeLabel,
  onRemove,
  editLabel = 'Edit image',
  onEdit,
  children
}: MediaToolbarProps) {
  return (
    <div className="flex w-full items-center justify-between p-2">
      <Button
        variant="icon"
        aria-label={removeLabel}
        onClick={onRemove}
      >
        <Trash2 strokeWidth={2.5} className="w-3.5 h-3.5" />
      </Button>
      <div className="flex items-center gap-1">
        {onEdit && (
          <Button variant="icon" aria-label={editLabel} onClick={onEdit}>
            <Crop strokeWidth={2.5} className="w-3.5 h-3.5" />
          </Button>
        )}
        <label className="p-1 text-foreground-muted cursor-pointer">
          <span className="sr-only">{changeLabel}</span>
          <SquarePen strokeWidth={2.5} className="w-3.5 h-3.5" />
          {children}
        </label>
      </div>
    </div>
  )
}
