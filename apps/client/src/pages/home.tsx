import { CircleUserRound } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDebouncedCallback } from 'use-debounce'

import {
  AccountScreen,
  Button,
  CreateTopicScreen,
  SelectionModeHeader,
  SelectionModeFooter,
  Spinner,
  TopicItem,
  TopicScreen,
  CreateTopicButton,
  Header,
  Search
} from '@/components'
import { useSync } from '@/contexts'
import { Topic } from '@/models'
import { useTopicsStore } from '@/store'

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20, transition: { duration: 0.25 } }
}

export default function HomePage() {
  const topics = useTopicsStore(state => state.topics)
  const isLoading = useTopicsStore(state => state.isLoading)
  const loadTopics = useTopicsStore(state => state.loadTopics)
  const addTopic = useTopicsStore(state => state.addTopic)
  const deleteTopics = useTopicsStore(state => state.deleteTopics)
  const searchTopics = useTopicsStore(state => state.searchTopics)

  const { status } = useSync()

  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const [searchParams, setSearchParams] = useSearchParams()
  const isCreating = searchParams.get('create') === 'true'
  const currentTopic = searchParams.get('topicId')
  const isAccountOpen = searchParams.get('account') === 'true'

  useEffect(() => {
    if (!isCreating && !currentTopic) {
      void loadTopics()
    }
  }, [isCreating, currentTopic, loadTopics])

  const handleCreateTopic = (topic: Topic): void => {
    addTopic(topic)
  }

  const handlePress = (isPressed: boolean): void => {
    setIsSelectionMode(isPressed)
  }

  const handleSelectItem = (topicId: string, add: boolean = true): void => {
    setSelectedItems(prev =>
      add ? [...prev, topicId] : prev.filter(tId => tId !== topicId)
    )
  }

  const handleCancelSelectedMode = (): void => {
    setIsSelectionMode(false)
    setSelectedItems([])
  }

  const handleSelectAll = (isSelectAll: boolean): void => {
    setSelectedItems(isSelectAll ? topics.map(topic => topic.id) : [])
  }

  const handleDeleteSelectedItems = async (): Promise<void> => {
    try {
      await deleteTopics(selectedItems)

      if (useTopicsStore.getState().topics.length === 0) {
        setIsSelectionMode(false)
      }

      setSelectedItems([])
    } catch (error) {
      console.error('Failed to delete some topics:', error)
    }
  }

  const handleSearch = useDebouncedCallback((value: string) => {
    searchTopics(value)
  }, 300)

  return (
    <main>
      <AnimatePresence>
        {isSelectionMode && (
          <SelectionModeHeader
            handleCancel={handleCancelSelectedMode}
            selectedItemsCount={selectedItems.length}
            isAllSelected={selectedItems.length === topics.length}
            handleSelectAll={handleSelectAll}
          />
        )}
      </AnimatePresence>

      <Header>
        <span className="w-6" />
        <span className="font-bold">Topics</span>
        <Button
          ariaLabel="Account"
          onClick={() => setSearchParams({ account: 'true' })}
        >
          <CircleUserRound />
        </Button>
      </Header>
      <Search onSearch={handleSearch} placeholder="Search topics" />

      <div className="relative h-[calc(100dvh-60px)]">
        <div className="absolute w-full h-4 bg-linear-to-b from-background to-background/30" />
        {isLoading || (status === 'syncing' && topics.length === 0) ? (
          <Spinner />
        ) : topics.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p>No topics found.</p>
              <p>Click the + button to create one!</p>
            </div>
          </div>
        ) : (
          <motion.ul
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="h-full px-4 pt-0 pb-20 overflow-y-auto"
          >
            <AnimatePresence>
              {topics.map(topic => (
                <motion.li
                  key={topic.id}
                  variants={itemVariants}
                  layout
                  exit="exit"
                >
                  <TopicItem
                    topic={topic}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedItems.includes(topic.id)}
                    onPress={handlePress}
                    onSelect={handleSelectItem}
                    onOpen={() => setSearchParams({ topicId: topic.id })}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
      <CreateTopicButton
        isHidden={isSelectionMode}
        onClick={() => setSearchParams({ create: 'true' })}
      />
      <AnimatePresence>
        {isSelectionMode && (
          <SelectionModeFooter
            countItemsForDelete={selectedItems.length}
            nameItemsForDelete="topic"
            handleDelete={handleDeleteSelectedItems}
          />
        )}
      </AnimatePresence>

      <CreateTopicScreen isOpen={isCreating} onCreate={handleCreateTopic} />

      <AccountScreen isOpen={isAccountOpen} />

      <TopicScreen
        isOpen={currentTopic !== null}
        topicId={currentTopic ?? ''}
        onClose={() => setSearchParams({})}
      />
    </main>
  )
}
