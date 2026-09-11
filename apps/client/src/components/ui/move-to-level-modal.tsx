import { motion, AnimatePresence } from 'motion/react'

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
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-background-overlay z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed bottom-4 left-4 right-4 z-50 bg-card rounded-3xl p-6"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <h2 className="text-xl font-semibold text-center mb-4">
              Move to level
            </h2>

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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
