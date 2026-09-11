import { FolderInput, Trash } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

import ConfirmDeleteModal from './confirm-delete-modal'
import MoveToLevelModal from './move-to-level-modal'

type SelectionModeFooterProps = {
  countItemsForDelete: number
  nameItemsForDelete: 'topic' | 'card'
  handleDelete: () => void
  handleMove?: (level: number) => void
  currentLevel?: number
}

export default function SelectionModeFooter({
  countItemsForDelete,
  nameItemsForDelete,
  handleDelete,
  handleMove,
  currentLevel = 0
}: SelectionModeFooterProps) {
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] =
    useState(false)
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)

  return (
    <>
      <motion.div
        key="selection-mode-footer"
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="absolute bottom-0 left-0 right-0 w-full flex justify-between items-center gap-10 p-4 pb-2 bg-background"
      >
        {handleMove && (
          <button
            onClick={() => setIsMoveModalOpen(true)}
            disabled={countItemsForDelete === 0}
            className="flex flex-col justify-center items-center gap-2 disabled:text-foreground-subtle text-foreground"
          >
            <span>
              <FolderInput />
            </span>
            <span className="text-xs">Move</span>
          </button>
        )}
        <button
          onClick={() => setIsConfirmDeleteModalOpen(true)}
          disabled={countItemsForDelete === 0}
          className="flex flex-col justify-center items-center gap-2 disabled:text-foreground-subtle text-danger"
        >
          <span>
            <Trash />
          </span>
          <span className="text-xs">Delete</span>
        </button>
      </motion.div>
      <ConfirmDeleteModal
        isOpen={isConfirmDeleteModalOpen}
        onConfirm={handleDelete}
        onClose={() => setIsConfirmDeleteModalOpen(false)}
        count={countItemsForDelete}
        itemName={nameItemsForDelete}
      />
      {handleMove && (
        <MoveToLevelModal
          isOpen={isMoveModalOpen}
          onClose={() => setIsMoveModalOpen(false)}
          onSelect={handleMove}
          currentLevel={currentLevel}
        />
      )}
    </>
  )
}
