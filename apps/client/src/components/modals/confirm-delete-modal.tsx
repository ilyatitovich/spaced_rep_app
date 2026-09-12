import Modal from './modal'

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
    <Modal isOpen={isOpen} onClose={onClose}>
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
    </Modal>
  )
}
