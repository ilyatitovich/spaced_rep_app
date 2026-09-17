import { useEffect, useState } from 'react'

import Modal from './modal'
import Spinner from '../ui/spinner'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
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
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!isOpen) setIsDeleting(false)
  }, [isOpen])

  const label =
    count > 1
      ? `${count} ${itemName}s`
      : count === 1
        ? itemName
        : itemName

  const handleClose = (): void => {
    if (isDeleting) return
    onClose()
  }

  const handleConfirm = async (): Promise<void> => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Failed to delete:', error)
      setIsDeleting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isDeleting ? undefined : `Delete ${label}?`}
    >
      {isDeleting ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner />
          <p className="text-foreground-muted text-center text-sm">
            Deleting {label}…
          </p>
        </div>
      ) : (
        <>
          <p className="text-foreground-muted text-center mb-6">
            This action cannot be undone
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl bg-secondary text-foreground active:scale-95"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              className="flex-1 py-3 rounded-xl text-danger bg-secondary active:scale-95"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
