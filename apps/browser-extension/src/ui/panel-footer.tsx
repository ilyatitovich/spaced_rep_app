import { useCallback } from 'react'
import Button from '@/components/ui/button'
import { Download, List, SquarePen } from 'lucide-react'
import { exportCards } from '@ext/lib/export'

interface PanelFooterProps {
  savedCount: number
  view: 'editor' | 'cards'
  onShowEditor: () => void
  onShowCards: () => void
  onExport?: () => Promise<void>
}

const buttonClassName = 'text-sm flex gap-2 flex-1'

export default function PanelFooter({
  savedCount,
  view,
  onExport,
  onShowCards,
  onShowEditor
}: PanelFooterProps) {
  const handleExport = useCallback(async () => {
    await exportCards()
    await onExport?.()
  }, [onExport])

  const toggleButton =
    view === 'editor'
      ? { Icon: List, label: 'Show cards', onClick: onShowCards }
      : { Icon: SquarePen, label: 'Create card', onClick: onShowEditor }

  return (
    <footer className="p-3 border-t border-border flex gap-2 items-center justify-center">
      <Button
        variant="outline"
        className={`${buttonClassName} disabled:opacity-40`}
        disabled={!savedCount}
        onClick={handleExport}
      >
        <Download size={17} /> Export {savedCount ? `(${savedCount})` : ''}
      </Button>

      <Button
        variant="outline"
        className={buttonClassName}
        onClick={toggleButton.onClick}
      >
        <toggleButton.Icon size={17} /> {toggleButton.label}
      </Button>
    </footer>
  )
}
