import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Navbar, Content, CreateTopic } from '@/components'
import { useTopicStore } from '@/stores'

const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
}

export default function HomePage() {
  const { topics, currentTopic, fetchAllTopics, clearCurrent } = useTopicStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const isCreating = searchParams.get('create') === 'true'

  useEffect(() => {
    if (!isCreating) {
      fetchAllTopics()
    }

    if (currentTopic) {
      clearCurrent()
    }
  }, [clearCurrent, currentTopic, fetchAllTopics, isCreating])

  const openCreate = () => setSearchParams({ create: 'true' })

  const closeCreate = () => {
    setSearchParams({})
  }

  return (
    <main>
      <Navbar>
        <span>Topics</span>
      </Navbar>
      <Content>
        {topics.length > 0 ? (
          <motion.ul variants={listVariants} initial="hidden" animate="visible">
            {topics.map(topic => (
              <motion.li key={topic.id} variants={itemVariants}>
                <Link
                  to={`topic/${topic.id}`}
                  className="w-full flex items-center justify-center px-4 py-6 my-4 mx-auto rounded-xl text-black bg-white active:scale-95"
                  aria-label={`Go to topic: ${topic.title}`}
                >
                  {topic.title}
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p>No topics to study yet</p>
          </div>
        )}
      </Content>
      <motion.button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-purple-700 text-white text-4xl shadow-lg flex items-center justify-center active:scale-90"
        onClick={openCreate}
      >
        <div className="relative w-6 h-6 flex items-center justify-center">
          <div className="absolute w-5 h-1 bg-white rounded-full"></div>
          <div className="absolute h-5 w-1 bg-white rounded-full"></div>
        </div>
      </motion.button>
      <AnimatePresence>
        {isCreating && (
          <motion.div
            key="create"
            initial={{ y: '100%' }} // start offscreen at bottom
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="fixed inset-0 bg-background z-50 flex flex-col rounded-t-2xl shadow-lg overflow-hidden"
          >
            <CreateTopic handleClose={closeCreate} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
