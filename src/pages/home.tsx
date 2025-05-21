import { Link, useLoaderData } from 'react-router-dom'

import { Button, Navbar, Content } from '../components/ui'
import { TopicItem } from '../lib/definitions'
import { getTopicsList } from '../lib/utils'

export async function loader() {
  const topics: TopicItem[] = getTopicsList()
  return { topics }
}

export default function Home() {
  const { topics } = useLoaderData() as { topics: TopicItem[] }

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
