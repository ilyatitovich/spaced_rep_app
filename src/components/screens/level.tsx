import { AnimatePresence, motion } from 'motion/react'
import { useState, useCallback, memo } from 'react'

import {
  BackButton,
  LevelCard,
  Screen,
  SelectionModeHeader,
  SelectionModeFooter,
  Header
} from '@/components'
import { getReviewMessage, getLevelDescription } from '@/lib'
import { Card } from '@/models'
import { deleteCardsBulk } from '@/services'
import { useScreenStore, useTopicStore } from '@/stores'

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20, transition: { duration: 0.25 } }
}

export default memo(function LevelScreen() {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [levelCards, setLevelCards] = useState<Card[]>([])

  const isOpen = useScreenStore(s => s.isLevelOpen)
  const levelId = useTopicStore(s => s.level) ?? 0
  const cards = useTopicStore(s => s.cards)

  const startDate = useTopicStore.getState().topic?.pivot

  const onOpen = useCallback(() => {
    setLevelCards(levelId !== undefined ? (cards[levelId] ?? []) : [])
  }, [cards, levelId])

  const onClose = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedItems([])
    setLevelCards([])
  }, [])

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
    setSelectedItems(isSelectAll ? levelCards.map(c => c.id) : [])
  }

  const handleDeleteSelectedItems = async (): Promise<void> => {
    try {
      await deleteCardsBulk(selectedItems)
      const restCards = levelCards.filter(
        card => !selectedItems.includes(card.id)
      )
      useTopicStore.getState().setCards(prev => ({
        ...prev,
        [Number(levelId)]: restCards
      }))

      if (restCards.length === 0) {
        setIsSelectionMode(false)
      }

      setSelectedItems([])
    } catch (error) {
      console.error('Failed to delete some topics:', error)
    }
  }

  return (
    <Screen isOpen={isOpen} onClose={onClose} onOpen={onOpen}>
      <AnimatePresence>
        {isSelectionMode && (
          <SelectionModeHeader
            handleCancel={handleCancelSelectedMode}
            selectedItemsCount={selectedItems.length}
            isAllSelected={selectedItems.length === levelCards.length}
            handleSelectAll={handleSelectAll}
          />
        )}
      </AnimatePresence>

      <Header>
        <BackButton />
        <span className="font-semibold">
          {levelId?.toString() === '0' ? 'Draft' : `Level ${levelId}`}
        </span>
      </Header>

      <div className="flex flex-col overflow-y-auto h-[calc(100dvh-60px)]">
        <div className="w-full text-center p-4">
          <p className="text-[16px] text-gray-900">
            {`${levelCards.length} card${levelCards.length === 1 ? '' : 's'}${['0', '8'].includes(levelId.toString()) ? '' : `, next review: ${getReviewMessage(startDate ?? 0, Number(levelId))}`}`}
          </p>
        </div>

        {levelCards.length > 0 && (
          <motion.div
            className="grid grid-cols-3 gap-4 content-start p-4"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence>
              {levelCards.map(card => (
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
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        <div className="w-full p-4">
          <p className="text-[12px] text-gray-600 whitespace-pre-line">
            {getLevelDescription(levelId.toString())}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {isSelectionMode && (
          <SelectionModeFooter
            countItemsForDelete={selectedItems.length}
            handleDelete={handleDeleteSelectedItems}
            nameItemsForDelete="card"
          />
        )}
      </AnimatePresence>
    </Screen>
  )
})
