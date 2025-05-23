import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { Button, Navbar, Content } from '@/components'
import { TopicItem } from '@/lib/definitions'
import { getAllTopics } from '@/services'

export default function Home() {
  const [topics, setTopics] = useState<TopicItem[]>([])

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const topics = await getAllTopics()
        setTopics(topics)
      } catch (error) {
        console.error('Error fetching topics:', error)
      }
    }
    fetchTopics()
  }, [])

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
                  className="w-full flex items-center justify-center p-4 my-4 mx-auto rounded-xl text-black gradient"
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
        <Button href="new-topic" aria-label="Create a new topic">
          Create Topic
        </Button>
      </footer>
    </main>
  )
}
