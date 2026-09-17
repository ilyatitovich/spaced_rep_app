import Modal from './modal'
import { LEVELS, levelLabel } from '@/lib'

type MoveToLevelModalProps = {
  isOpen: boolean
  onClose: () => void
  onSelect: (level: number) => void
  currentLevel: number
}

export default function MoveToLevelModal({
  isOpen,
  onClose,
  onSelect,
  currentLevel
}: MoveToLevelModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="center"
      title="Move to level"
    >
      <ul className="flex flex-col gap-3">
        {LEVELS.map(level => {
          const isCurrent = level === currentLevel
          return (
            <li key={level}>
              <button
                type="button"
                disabled={isCurrent}
                onClick={() => {
                  onSelect(level)
                  onClose()
                }}
                className="w-full flex items-center justify-center py-4 px-4 rounded-xl text-left text-primary
                bg-muted disabled:text-foreground-subtle disabled:opacity-50 active:bg-secondary"
              >
                {levelLabel(level)}
                {isCurrent ? ' (current)' : ''}
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
