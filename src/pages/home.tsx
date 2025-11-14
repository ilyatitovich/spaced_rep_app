import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  Content,
  CreateTopic,
  SelectionModeHeader,
  SelectionModeFooter,
  Spinner,
  TopicItem,
  CreateTopicButton
} from '@/components'
import { Topic } from '@/models'
import { getAllTopics, deleteTopic } from '@/services'

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
  const [topics, setTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const [searchParams, setSearchParams] = useSearchParams()
  const isCreating = searchParams.get('create') === 'true'

  useEffect(() => {
    const loadTopics = async (): Promise<void> => {
      try {
        if (!isCreating) {
          const topics = await getAllTopics()
          setTopics(topics)
        }
      } catch (err) {
        console.error('Failed to load topics:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadTopics()
  }, [isCreating])

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
      setTopics(restTopics)

      if (restTopics.length === 0) {
        setIsSelectionMode(false)
      }

      setSelectedItems([])
      console.log('All topics deleted successfully')
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

      <div className="p-4 border-b border-gray-200 flex items-center justify-center">
        <span>Topics</span>
      </div>

      <Content>
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
          <motion.ul variants={listVariants} initial="hidden" animate="visible">
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
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </Content>
      <CreateTopicButton
        isHidden={isSelectionMode}
        onClick={() => setSearchParams({ create: 'true' })}
      />
      <AnimatePresence>
        {isSelectionMode && (
          <SelectionModeFooter
            countItemsForDelete={selectedItems.length}
            handleDelete={handleDeleteSelectedItems}
          />
        )}
      </AnimatePresence>

      <CreateTopic isOpen={isCreating} onClose={() => setSearchParams({})} />
    </main>
  )
}
