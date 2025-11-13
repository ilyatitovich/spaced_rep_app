import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  Navbar,
  Content,
  CreateTopic,
  SelectionModeHeader,
  SelectionModeFooter,
  Spinner,
  TopicItem
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
    const loadTopics = async () => {
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

  const handleDeleteSelectedItems = async () => {
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

      <Navbar>
        <span>Topics</span>
      </Navbar>

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
      <AnimatePresence>
        {!isSelectionMode && (
          <motion.button
            key="create-topic-button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-purple-700 text-white text-4xl shadow-lg flex items-center justify-center active:scale-90"
            onClick={() => setSearchParams({ create: 'true' })}
          >
            <div className="relative w-6 h-6 flex items-center justify-center">
              <div className="absolute w-5 h-1 bg-white rounded-full"></div>
              <div className="absolute h-5 w-1 bg-white rounded-full"></div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSelectionMode && (
          <SelectionModeFooter
            isItemsForDelete={selectedItems.length === 0}
            handleDelete={handleDeleteSelectedItems}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isCreating && <CreateTopic handleClose={() => setSearchParams({})} />}
      </AnimatePresence>
    </main>
  )
}
