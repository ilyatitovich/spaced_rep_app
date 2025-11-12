import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Link } from 'react-router'

import { Button, Navbar, Content } from '@/components'
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
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
}

export default function HomePage() {
  const { topics, currentTopic, fetchAllTopics, clearCurrent } = useTopicStore()

  useEffect(() => {
    fetchAllTopics()

    if (currentTopic) {
      clearCurrent()
    }
  }, [clearCurrent, currentTopic, fetchAllTopics])

  return (
    <main>
      <Navbar>
        <span>Topics</span>
      </Navbar>
      <Content>
        {topics.length > 0 ? (
          <motion.ul
            className="topics"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            {topics.map(topic => (
              <motion.li key={topic.id} variants={itemVariants}>
                <Link
                  to={`topic/${topic.id}`}
                  className="w-full flex items-center justify-center px-4 py-6 my-4 mx-auto rounded-xl text-black gradient"
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
      <footer>
        <Button href="new-topic">Create Topic</Button>
      </footer>
    </main>
  )
}
