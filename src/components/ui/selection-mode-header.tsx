import { X, ListCheck } from 'lucide-react'
import { motion } from 'motion/react'

type SelectionModeHeaderProps = {
  selectedItemsCount: number
  isAllSelected: boolean
  handleCancel: () => void
  handleSelectAll: (isSelect: boolean) => void
}

export default function SelectionModeHeader({
  selectedItemsCount,
  isAllSelected = false,
  handleCancel,
  handleSelectAll
}: SelectionModeHeaderProps) {
  return (
    <motion.div
      key="selection-mode-header"
      initial={{ opacity: 0, y: '-100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '-100%' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="absolute top-0 left-0 right-0 w-full flex justify-between items-center p-4 bg-background"
    >
      <button onClick={handleCancel}>
        <X />
      </button>
      <span>
        {selectedItemsCount === 0
          ? 'Select items'
          : `${selectedItemsCount} selected ${selectedItemsCount === 1 ? 'item' : 'items'}`}
      </span>
      <button onClick={() => handleSelectAll(!isAllSelected)}>
        <ListCheck
          className={`${isAllSelected ? 'text-purple-600' : 'text-black'}`}
        />
      </button>
    </motion.div>
  )
}
