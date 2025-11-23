import { AnimatePresence, motion } from 'motion/react'
import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router'

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

type LevelScreenProps = {
  isOpen: boolean
  levelId: string
  cards: Card[]
  startDate: number
  onDeleteCards: (cards: Card[]) => void
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
  startDate,
  onDeleteCards
}: LevelScreenProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [levelCards, setLevelCards] = useState<Card[]>([])
  const [currentLevelId, setCurrentLevelId] = useState('')

  const [_, setSearchParams] = useSearchParams()

  const onOpen = useCallback(() => {
    setLevelCards(cards)
    setCurrentLevelId(levelId)
  }, [cards, levelId])

  const onClose = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedItems([])
    setLevelCards([])
    setCurrentLevelId('')
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
          {currentLevelId === '0' ? 'Draft' : `Level ${currentLevelId}`}
        </span>
      </Header>

      <div className="flex flex-col overflow-y-auto h-[calc(100dvh-60px)]">
        <div className="w-full text-center p-4">
          <p className="text-[16px] text-gray-900">
            {`${levelCards.length} card${levelCards.length === 1 ? '' : 's'}${['0', '8'].includes(currentLevelId) ? '' : `, next review: ${getReviewMessage(startDate, Number(currentLevelId))}`}`}
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
                    onOpen={() => {
                      setSearchParams(prev => {
                        const params = new URLSearchParams(prev)
                        params.set('cardId', card.id)
                        return params
                      })
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        <div className="w-full p-4">
          <p className="text-[12px] text-gray-600 whitespace-pre-line">
            {getLevelDescription(currentLevelId)}
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
}
