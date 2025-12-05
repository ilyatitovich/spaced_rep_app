import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  CreateTopicScreen,
  SelectionModeHeader,
  SelectionModeFooter,
  Spinner,
  TopicItem,
  TopicScreen,
  CreateTopicButton,
  Header
} from '@/components'
import { useTopic } from '@/contexts'
import { deleteTopic } from '@/services'

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
  const {
    allTopics: topics,
    fetchAllTopics,
    setAllTopics,
    isLoading
  } = useTopic()

  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const [searchParams, setSearchParams] = useSearchParams()
  const isCreating = searchParams.get('create') === 'true'
  const currentTopic = searchParams.get('topicId')

  useEffect(() => {
    fetchAllTopics()
  }, [fetchAllTopics])

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
      await Promise.all(selectedItems.map(topicId => deleteTopic(topicId)))
      const restTopics = topics.filter(
        topic => !selectedItems.includes(topic.id)
      )
      setAllTopics(restTopics)

      if (restTopics.length === 0) {
        setIsSelectionMode(false)
      }

      setSelectedItems([])
    } catch (error) {
      console.error('Failed to delete some topics:', error)
    }
  }

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
        <span>Topics</span>
      </Header>

      <div className="h-[calc(100dvh-60px)]">
        {isLoading ? (
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

      <CreateTopicScreen isOpen={isCreating} />

      <TopicScreen
        isOpen={currentTopic !== null}
        topicId={currentTopic ?? ''}
        onClose={() => setSearchParams({})}
      />
    </main>
  )
}
