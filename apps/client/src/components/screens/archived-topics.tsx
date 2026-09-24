import { List } from 'lucide-react'
import { useSearchParams } from 'react-router'

import {
  BackButton,
  Header,
  Screen,
  SelectionModeFooter,
  SelectionModeHeader,
  Button,
  TopicItem
} from '@/components'
import { useSelectionMode } from '@/hooks'
import { useTopicsStore } from '@/store'

type ArchivedTopicsScreenProps = {
  isOpen: boolean
}

export default function ArchivedTopicsScreen({
  isOpen
}: ArchivedTopicsScreenProps) {
  const archivedTopics = useTopicsStore(state => state.archivedTopics)
  const deleteTopics = useTopicsStore(state => state.deleteTopics)
  const unarchiveTopics = useTopicsStore(state => state.unarchiveTopics)

  const {
    isSelectionMode,
    selectedItems,
    setIsSelectionMode,
    selectItem,
    selectAll,
    cancelSelectionMode,
    deleteSelected
  } = useSelectionMode()

  const [, setSearchParams] = useSearchParams()

  const handleSelectAll = (isSelectAll: boolean): void => {
    selectAll(
      archivedTopics.map(topic => topic.id),
      isSelectAll
    )
  }

  const handleDeleteSelectedItems = (): Promise<void> =>
    deleteSelected(async ids => {
      await deleteTopics(ids)
      return useTopicsStore.getState().archivedTopics.length === 0
    })

  const handleUnarchiveSelected = async (): Promise<void> => {
    try {
      await unarchiveTopics(selectedItems)
      cancelSelectionMode()
    } catch (error) {
      console.error('Failed to unarchive topics:', error)
    }
  }

  return (
    <Screen
      isOpen={isOpen}
      onClose={() => {
        cancelSelectionMode()
      }}
    >
      <div className="relative h-full bg-background flex flex-col overflow-hidden">
        <SelectionModeHeader
          isHidden={!isSelectionMode}
          handleCancel={cancelSelectionMode}
          selectedItemsCount={selectedItems.length}
          isAllSelected={selectedItems.length === archivedTopics.length}
          handleSelectAll={handleSelectAll}
        />

        <Header>
          <BackButton />
          <span className="font-bold">Archived</span>
          <Button onClick={() => setIsSelectionMode(true)}>
            <List />
          </Button>
        </Header>

        <div className="relative h-[calc(100dvh-60px)]">
          {archivedTopics.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-foreground-muted">
                <p>No archived topics.</p>
              </div>
            </div>
          ) : (
            <ul
              className={`h-full px-4 pt-0 overflow-y-auto ${
                isSelectionMode
                  ? 'pb-[calc(10rem+env(safe-area-inset-bottom,0px))]'
                  : 'pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]'
              }`}
            >
              {archivedTopics.map(topic => (
                <li key={topic.id}>
                  <TopicItem
                    topic={topic}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedItems.includes(topic.id)}
                    onSelect={selectItem}
                    onOpen={() =>
                      setSearchParams(prev => {
                        const params = new URLSearchParams(prev)
                        params.set('topicId', topic.id)
                        return params
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <SelectionModeFooter
          isHidden={!isSelectionMode}
          countItemsForDelete={selectedItems.length}
          nameItemsForDelete="topic"
          handleDelete={handleDeleteSelectedItems}
          handleArchive={handleUnarchiveSelected}
          archiveLabel="Unarchive"
        />
      </div>
    </Screen>
  )
}
