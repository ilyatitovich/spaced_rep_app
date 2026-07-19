import { motion, AnimatePresence } from 'motion/react'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  count: number
  itemName: 'topic' | 'card'
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  count,
  itemName
}: ConfirmDeleteModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Background overlay */}
          <motion.div
            className="fixed inset-0 bg-background-overlay z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed bottom-4 left-4 right-4 z-50 bg-card rounded-3xl p-6"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <h2 className="text-xl font-semibold text-center mb-2">
              Delete{' '}
              {count
                ? `${count === 1 ? '' : count} ${count > 1 ? itemName + 's' : itemName}`
                : itemName}
              ?
            </h2>
            <p className="text-foreground-muted text-center mb-6">
              This action cannot be undone
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-secondary text-foreground active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
                className="flex-1 py-3 rounded-xl text-danger bg-secondary active:scale-95"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
