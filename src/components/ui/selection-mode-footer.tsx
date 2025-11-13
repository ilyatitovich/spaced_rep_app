import { Trash } from 'lucide-react'
import { motion } from 'motion/react'

type SelectionModeFooterProps = {
  isItemsForDelete: boolean
  handleDelete: () => void
}

export default function SelectionModeFooter({
  isItemsForDelete,
  handleDelete
}: SelectionModeFooterProps) {
  return (
    <motion.div
      key="selection-mode-footer"
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="absolute bottom-0 left-0 right-0 w-full flex justify-center items-center p-4 pb-2 bg-background"
    >
      <button
        onClick={handleDelete}
        disabled={isItemsForDelete}
        className="flex flex-col justify-center items-center gap-2 disabled:text-gray-500"
      >
        <span>
          <Trash />
        </span>
        <span className="text-xs">Delete</span>
      </button>
    </motion.div>
  )
}
