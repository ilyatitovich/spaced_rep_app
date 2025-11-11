import { useEffect } from 'react'
import { Link } from 'react-router'

import { Button, Navbar, Content } from '@/components'
import { useTopicStore } from '@/stores'

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
        <h1>Topics</h1>
      </Navbar>
      <Content>
        {topics.length > 0 ? (
          <ul className="topics">
            {topics.map(topic => (
              <li key={topic.id}>
                <Link
                  to={`topic/${topic.id}`}
                  className="w-full flex items-center justify-center px-4 py-6 my-4 mx-auto rounded-xl text-black gradient"
                  aria-label={`Go to topic: ${topic.title}`}
                >
                  {topic.title}
                </Link>
              </li>
            ))}
          </ul>
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
