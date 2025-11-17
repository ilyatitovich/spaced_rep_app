import { AnimatePresence, motion } from 'motion/react'
import { useState, useEffect, useRef } from 'react'

import {
  BackButton,
  LevelCard,
  SelectionModeHeader,
  SelectionModeFooter
} from '@/components'
import { Card } from '@/models'
import { deleteCardsBulk } from '@/services'

type LevelScreenProps = {
  isOpen: boolean
  levelId: string
  cards: Card[]
  onDeleteCards: (cards: Card[]) => void
  onShowCardDatails: (cardId: string) => void
  onClose: () => void
}

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20, transition: { duration: 0.25 } }
}

export default function LevelScreen({
  isOpen,
  levelId,
  cards,
  onDeleteCards,
  onShowCardDatails,
  onClose
}: LevelScreenProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const screenRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      const node = screenRef.current
      if (!node) return

      const handleEnd = () => {
        setIsSelectionMode(false)
        setSelectedItems([])
        node.removeEventListener('transitionend', handleEnd)
      }

      node.addEventListener('transitionend', handleEnd)
    }
  }, [isOpen])

  const handleClose = (): void => {
    onClose()
  }

  const handlePress = (isPressed: boolean): void => {
    setIsSelectionMode(isPressed)
  }

  const handleSelectItem = (cardId: string, add: boolean = true): void => {
    setSelectedItems(prev =>
      add ? [...prev, cardId] : prev.filter(cId => cId !== cardId)
    )
  }

  const handleCancelSelectedMode = (): void => {
    setIsSelectionMode(false)
    setSelectedItems([])
  }

  const handleSelectAll = (isSelectAll: boolean): void => {
    setSelectedItems(isSelectAll ? cards.map(c => c.id) : [])
  }

  const handleDeleteSelectedItems = async (): Promise<void> => {
    try {
      await deleteCardsBulk(selectedItems)
      const restCards = cards.filter(card => !selectedItems.includes(card.id))
      onDeleteCards(restCards)

      if (restCards.length === 0) {
        setIsSelectionMode(false)
      }

      setSelectedItems([])
    } catch (error) {
      console.error('Failed to delete some topics:', error)
    }
  }

  return (
    <div
      ref={screenRef}
      className={`${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
    >
      <AnimatePresence>
        {isSelectionMode && (
          <SelectionModeHeader
            handleCancel={handleCancelSelectedMode}
            selectedItemsCount={selectedItems.length}
            isAllSelected={selectedItems.length === cards.length}
            handleSelectAll={handleSelectAll}
          />
        )}
      </AnimatePresence>

      <div className="relative w-full p-4 flex justify-between items-center border-b border-gray-200">
        <BackButton onClick={handleClose} />
        <span className="font-semibold">
          {levelId === '0' ? 'Draft' : `Level ${levelId}`}
        </span>
      </div>

      {cards.length > 0 ? (
        <motion.div
          className="grid grid-cols-3 gap-4 content-start p-4"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence>
            {cards.map(card => (
              <motion.div
                key={card.id}
                variants={itemVariants}
                layout
                exit="exit"
              >
                <LevelCard
                  card={card}
                  isSelected={selectedItems.includes(card.id)}
                  isSelectionMode={isSelectionMode}
                  onPress={handlePress}
                  onSelect={handleSelectItem}
                  onOpen={() => onShowCardDatails(card.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-500">
          No cards
        </p>
      )}

      <AnimatePresence>
        {isSelectionMode && (
          <SelectionModeFooter
            countItemsForDelete={selectedItems.length}
            handleDelete={handleDeleteSelectedItems}
            nameItemsForDelete="card"
          />
        )}
      </AnimatePresence>
    </div>
  )
}
