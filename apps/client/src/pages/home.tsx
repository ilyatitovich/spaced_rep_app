import { Archive, CircleUserRound, List } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useDebouncedCallback } from 'use-debounce'

import {
  ArchivedTopicsScreen,
  Avatar,
  SettingsScreen,
  Button,
  CreateTopicScreen,
  SelectionModeHeader,
  SelectionModeFooter,
  Spinner,
  TopicItem,
  TopicScreen,
  CreateTopicButton,
  Header,
  Search,
  ScreenLayer
} from '@/components'
import { useAuth, useSync } from '@/contexts'
import { useSelectionMode } from '@/hooks'
import { Topic } from '@/models'
import { useTopicsStore } from '@/store'
import AuthScreen from '@/components/screens/auth'

export default function HomePage() {
  const topics = useTopicsStore(state => state.topics)
  const archivedTopics = useTopicsStore(state => state.archivedTopics)
  const searchQuery = useTopicsStore(state => state.searchQuery)
  const isLoading = useTopicsStore(state => state.isLoading)
  const loadTopics = useTopicsStore(state => state.loadTopics)
  const addTopic = useTopicsStore(state => state.addTopic)
  const deleteTopics = useTopicsStore(state => state.deleteTopics)
  const archiveTopics = useTopicsStore(state => state.archiveTopics)
  const searchTopics = useTopicsStore(state => state.searchTopics)

  const { status } = useSync()
  const { user } = useAuth()

  const {
    isSelectionMode,
    selectedItems,
    setIsSelectionMode,
    selectItem,
    selectAll,
    cancelSelectionMode,
    deleteSelected
  } = useSelectionMode()

  const [searchParams, setSearchParams] = useSearchParams()
  const isCreating = searchParams.get('create') === 'true'
  const currentTopic = searchParams.get('topicId')
  const isSettingsOpen = searchParams.get('settings') === 'true'
  const isAuthScreenOpen = searchParams.get('auth') === 'true'
  const isArchivedOpen = searchParams.get('archived') === 'true'

  const avatarUrl = user?.user_metadata?.avatar_url
  const avatarInitial = (user?.email?.[0] ?? '?').toUpperCase()

  useEffect(() => {
    if (!isCreating && !currentTopic) {
      void loadTopics()
    }
  }, [isCreating, currentTopic, loadTopics])

  const handleCreateTopic = (topic: Topic): void => {
    addTopic(topic)
  }

  const handleSelectAll = (isSelectAll: boolean): void => {
    selectAll(
      topics.map(topic => topic.id),
      isSelectAll
    )
  }

  const handleDeleteSelectedItems = (): Promise<void> =>
    deleteSelected(async ids => {
      await deleteTopics(ids)
      return useTopicsStore.getState().topics.length === 0
    })

  const handleArchiveSelected = async (): Promise<void> => {
    try {
      await archiveTopics(selectedItems)
      cancelSelectionMode()
    } catch (error) {
      console.error('Failed to archive topics:', error)
    }
  }

  const handleSearch = useDebouncedCallback((value: string) => {
    searchTopics(value)
  }, 300)

  return (
    <main>
      <ScreenLayer className="relative h-dvh">
        <SelectionModeHeader
          isHidden={!isSelectionMode}
          handleCancel={cancelSelectionMode}
          selectedItemsCount={selectedItems.length}
          isAllSelected={selectedItems.length === topics.length}
          handleSelectAll={handleSelectAll}
        />

        <Header>
          <Button onClick={() => setIsSelectionMode(true)}>
            <List />
          </Button>
          <span className="font-bold">Topics</span>
          <Button
            ariaLabel="Account"
            onClick={() => setSearchParams({ settings: 'true' })}
          >
            {user ? (
              <Avatar url={avatarUrl} initial={avatarInitial} size="sm" />
            ) : (
              <CircleUserRound size={24} />
            )}
          </Button>
        </Header>
        <Search onSearch={handleSearch} placeholder="Search topics" />

        {archivedTopics.length > 0 && !searchQuery && (
          <Button
            variant="unstyled"
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-foreground-muted"
            onClick={() => setSearchParams({ archived: 'true' })}
          >
            <Archive size={18} />
            <span className="flex-1 font-medium">Archived</span>
            <span className="text-sm">{archivedTopics.length}</span>
          </Button>
        )}

        <div className="relative h-[calc(100dvh-60px)]">
          <div className="absolute w-full h-4 bg-linear-to-b from-background to-background/30" />
          {isLoading || (status === 'syncing' && topics.length === 0) ? (
            <Spinner />
          ) : topics.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-foreground-muted">
                <p>No topics found.</p>
                <p>Click the + button to create one!</p>
              </div>
            </div>
          ) : (
            <ul className="h-full px-4 pt-0 pb-20 overflow-y-auto">
              {topics.map(topic => (
                <li key={topic.id}>
                  <TopicItem
                    topic={topic}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedItems.includes(topic.id)}
                    onSelect={selectItem}
                    onOpen={() => setSearchParams({ topicId: topic.id })}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <CreateTopicButton
          isHidden={isSelectionMode}
          onClick={() => setSearchParams({ create: 'true' })}
        />
        <SelectionModeFooter
          isHidden={!isSelectionMode}
          countItemsForDelete={selectedItems.length}
          nameItemsForDelete="topic"
          handleDelete={handleDeleteSelectedItems}
          handleArchive={handleArchiveSelected}
        />
      </ScreenLayer>

      <CreateTopicScreen isOpen={isCreating} onCreate={handleCreateTopic} />

      <SettingsScreen isOpen={isSettingsOpen} />

      <ArchivedTopicsScreen isOpen={isArchivedOpen} />

      <TopicScreen
        isOpen={currentTopic !== null}
        topicId={currentTopic ?? ''}
        onClose={() =>
          setSearchParams(prev => {
            const params = new URLSearchParams(prev)
            params.delete('topicId')
            params.delete('topicSettings')
            return params
          })
        }
      />

      <AuthScreen isOpen={isAuthScreenOpen} />
    </main>
  )
}
