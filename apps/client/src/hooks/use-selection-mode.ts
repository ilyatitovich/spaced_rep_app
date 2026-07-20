import { useCallback, useState } from 'react'

export function useSelectionMode() {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const selectItem = useCallback(
    (itemId: string, add: boolean = true): void => {
      setSelectedItems(prev =>
        add ? [...prev, itemId] : prev.filter(id => id !== itemId)
      )
    },
    []
  )

  const selectAll = useCallback(
    (allIds: string[], isSelectAll: boolean): void => {
      setSelectedItems(isSelectAll ? allIds : [])
    },
    []
  )

  const cancelSelectionMode = useCallback((): void => {
    setIsSelectionMode(false)
    setSelectedItems([])
  }, [])

  const deleteSelected = useCallback(
    async (
      deleteFn: (selectedIds: string[]) => Promise<boolean | void>
    ): Promise<void> => {
      try {
        const shouldExit = await deleteFn(selectedItems)

        if (shouldExit) {
          setIsSelectionMode(false)
        }

        setSelectedItems([])
      } catch (error) {
        console.error('Failed to delete selected items:', error)
      }
    },
    [selectedItems]
  )

  return {
    isSelectionMode,
    selectedItems,
    setIsSelectionMode,
    selectItem,
    selectAll,
    cancelSelectionMode,
    deleteSelected
  }
}
