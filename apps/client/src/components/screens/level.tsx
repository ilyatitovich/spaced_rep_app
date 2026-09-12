import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence } from 'motion/react'
import { useState, useCallback, useEffect, useRef } from 'react'
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
import { getReviewMessage, getLevelDescription, levelLabel } from '@/lib'
import { Card } from '@/models'
import { deleteCardsBulk, updateCardsLevelBulk } from '@/services'
import { List } from 'lucide-react'

type LevelScreenProps = {
  isOpen: boolean
  levelId: string
  isDone: boolean
  cards: Card[]
  startDate: number
  onDeleteCards: (cards: Card[]) => void
  onMoveCards: (remaining: Card[], moved: Card[], toLevel: number) => void
}

const COLS = 3
/** h-30 (120px) + gap-4 (16px) */
const ROW_SIZE = 136

export default function LevelScreen({
  isOpen,
  levelId,
  isDone,
  cards,
  startDate,
  onDeleteCards,
  onMoveCards
}: LevelScreenProps) {
  const [levelCards, setLevelCards] = useState<Card[]>([])
  const [currentLevelId, setCurrentLevelId] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (isOpen) setLevelCards(cards)
  }, [isOpen, cards])

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

  const handleMoveSelectedItems = async (toLevel: number): Promise<void> => {
    const selectedIds = new Set(selectedItems)
    const moved = levelCards.filter(card => selectedIds.has(card.id))
    try {
      await updateCardsLevelBulk(moved, toLevel)
      const remaining = levelCards.filter(card => !selectedIds.has(card.id))
      setLevelCards(remaining)
      onMoveCards(remaining, moved, toLevel)
      cancelSelectionMode()
    } catch (error) {
      console.error('Failed to move selected cards:', error)
    }
  }

  const rowCount = Math.ceil(levelCards.length / COLS)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_SIZE,
    overscan: 2
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
          {levelLabel(Number(currentLevelId))}
        </span>
        <Button onClick={() => setIsSelectionMode(true)}>
          <List size={24} />
        </Button>
      </Header>

      <div className="flex flex-col h-[calc(100dvh-60px)]">
        <div className="w-full text-center p-4 shrink-0">
          <p className="text-[16px] text-foreground">
            {`${levelCards.length} card${levelCards.length === 1 ? '' : 's'}${['0', '8'].includes(currentLevelId) ? '' : `, next review: ${getReviewMessage(startDate, Number(currentLevelId), isDone)}`}`}
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {levelCards.length > 0 && (
            <div
              className="relative w-full"
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const start = virtualRow.index * COLS
                const rowCards = levelCards.slice(start, start + COLS)

                return (
                  <div
                    key={virtualRow.key}
                    className="absolute top-0 left-0 w-full grid grid-cols-3 gap-4 px-4"
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    {rowCards.map(card => {
                      const cell = (
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
                      )

                      return <div key={card.id}>{cell}</div>
                    })}
                  </div>
                )
              })}
            </div>
          )}

          <div className="w-full p-4">
            <p className="text-[12px] text-foreground-muted whitespace-pre-line">
              {getLevelDescription(currentLevelId)}
            </p>
          </div>
        </div>
      </div>

      <SelectionModeFooter
        isHidden={!isSelectionMode}
        countItemsForDelete={selectedItems.length}
        handleDelete={handleDeleteSelectedItems}
        handleMove={handleMoveSelectedItems}
        currentLevel={Number(currentLevelId)}
        nameItemsForDelete="card"
      />
    </Screen>
  )
}
