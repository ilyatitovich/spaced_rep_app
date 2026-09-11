import { AnimatePresence, motion } from 'motion/react'

interface UpdateAppSheetProps {
  isOpen: boolean
  onUpdate: () => void
  onLater: () => void
}

export default function UpdateAppSheet({
  isOpen,
  onUpdate,
  onLater
}: UpdateAppSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl bg-card p-4 shadow-lg"
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          role="alert"
        >
          <p className="mb-4 text-sm text-foreground">
            A new version is available. Update now to get the latest
            improvements.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onLater}
              className="flex-1 rounded-xl bg-secondary text-foreground py-3 text-sm active:scale-95"
            >
              Later
            </button>
            <button
              type="button"
              onClick={onUpdate}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground active:scale-95"
            >
              Update
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
