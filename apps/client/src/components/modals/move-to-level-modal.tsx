import Modal from './modal'
import { LEVELS, levelLabel } from '@/lib'
import Button from '../ui/button'

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
              <Button
                variant="unstyled"
                size="lg"
                disabled={isCurrent}
                onClick={() => {
                  onSelect(level)
                  onClose()
                }}
                className="text-primary w-full rounded-xl bg-muted disabled:opacity-50 disabled:text-muted-foreground"
              >
                {levelLabel(level)}
                {isCurrent ? ' (current)' : ''}
              </Button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
