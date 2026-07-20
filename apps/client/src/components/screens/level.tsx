import { AnimatePresence, motion } from 'motion/react'
import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router'

import {
  BackButton,
  LevelCard,
  Screen,
  SelectionModeHeader,
  SelectionModeFooter,
  Header,
  Button
} from '@/components'
import { useSelectionMode } from '@/hooks'
import { getReviewMessage, getLevelDescription } from '@/lib'
import { Card } from '@/models'
import { deleteCardsBulk } from '@/services'
import { List } from 'lucide-react'

type LevelScreenProps = {
  isOpen: boolean
  levelId: string
  isDone: boolean
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
  isDone,
  cards,
  startDate,
  onDeleteCards
}: LevelScreenProps) {
  const [levelCards, setLevelCards] = useState<Card[]>([])
  const [currentLevelId, setCurrentLevelId] = useState('')

  const {
    isSelectionMode,
    selectedItems,
    setIsSelectionMode,
    selectItem,
    selectAll,
    cancelSelectionMode,
    deleteSelected
  } = useSelectionMode()

  const [_, setSearchParams] = useSearchParams()

  const onOpen = useCallback(() => {
    setLevelCards(cards)
    setCurrentLevelId(levelId)
  }, [cards, levelId])

  const onClose = useCallback(() => {
    cancelSelectionMode()
    setLevelCards([])
    setCurrentLevelId('')
  }, [cancelSelectionMode])

  const handleSelectAll = (isSelectAll: boolean): void => {
    selectAll(
      levelCards.map(card => card.id),
      isSelectAll
    )
  }

  const handleDeleteSelectedItems = (): Promise<void> =>
    deleteSelected(async ids => {
      await deleteCardsBulk(ids)
      const restCards = levelCards.filter(card => !ids.includes(card.id))
      onDeleteCards(restCards)
      return restCards.length === 0
    })

  return (
    <Screen isOpen={isOpen} onClose={onClose} onOpen={onOpen}>
      <AnimatePresence>
        {isSelectionMode && (
          <SelectionModeHeader
            handleCancel={cancelSelectionMode}
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
        <Button onClick={() => setIsSelectionMode(true)}>
          <List size={24} />
        </Button>
      </Header>

      <div className="flex flex-col overflow-y-auto h-[calc(100dvh-60px)]">
        <div className="w-full text-center p-4">
          <p className="text-[16px] text-foreground">
            {`${levelCards.length} card${levelCards.length === 1 ? '' : 's'}${['0', '8'].includes(currentLevelId) ? '' : `, next review: ${getReviewMessage(startDate, Number(currentLevelId), isDone)}`}`}
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
                    onPress={setIsSelectionMode}
                    onSelect={selectItem}
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
          <p className="text-[12px] text-foreground-muted whitespace-pre-line">
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
