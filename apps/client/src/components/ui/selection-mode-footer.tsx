import { FolderInput, Trash } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import ConfirmDeleteModal from './confirm-delete-modal'
import MoveToLevelModal from './move-to-level-modal'

type SelectionModeFooterProps = {
  countItemsForDelete: number
  nameItemsForDelete: 'topic' | 'card'
  handleDelete: () => void
  handleMove?: (level: number) => void
  currentLevel?: number
  isHidden?: boolean
}

export default function SelectionModeFooter({
  countItemsForDelete,
  nameItemsForDelete,
  handleDelete,
  handleMove,
  currentLevel = 0,
  isHidden = false
}: SelectionModeFooterProps) {
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] =
    useState(false)
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const footerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (footerRef.current) footerRef.current.inert = isHidden
    if (!isHidden) return
    setIsConfirmDeleteModalOpen(false)
    setIsMoveModalOpen(false)
  }, [isHidden])

  const justifyContent = handleMove ? 'justify-between' : 'justify-center'

  return (
    <>
      <div
        ref={footerRef}
        className={`absolute bottom-0 left-0 right-0 z-50 w-full flex ${justifyContent} items-center gap-10 pt-4 pb-2 px-safe-margins bg-background transition-[opacity,translate] duration-300 ease-in-out ${
          isHidden
            ? 'pointer-events-none translate-y-full opacity-0'
            : 'translate-y-0 opacity-100 starting:translate-y-full starting:opacity-0'
        }`}
      >
        {handleMove && (
          <button
            onClick={() => setIsMoveModalOpen(true)}
            disabled={countItemsForDelete === 0}
            className="flex flex-col justify-center items-center gap-2 disabled:text-foreground-subtle text-primary"
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
      </div>
      {!isHidden && (
        <ConfirmDeleteModal
          isOpen={isConfirmDeleteModalOpen}
          onConfirm={handleDelete}
          onClose={() => setIsConfirmDeleteModalOpen(false)}
          count={countItemsForDelete}
          itemName={nameItemsForDelete}
        />
      )}
      {handleMove && !isHidden && (
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
