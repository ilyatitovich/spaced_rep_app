import './Home.scss'

import { Link, useLoaderData } from 'react-router-dom'

import { TopicItem } from '../../lib/definitions'
import { getTopicsList } from '../../lib/utils'
import { Button, Navbar } from '../../components/ui'

// eslint-disable-next-line react-refresh/only-export-components
export async function loader() {
  const topics: TopicItem[] = getTopicsList()
  return { topics }
}

export default function Home() {
  const { topics } = useLoaderData() as { topics: TopicItem[] }

  return (
    <div className="home">
      <Navbar>
        <h1>Topics</h1>
      </Navbar>
      <div className="content">
        {topics.length > 0 ? (
          <div className="topics">
            <ul>
              {topics.map(topic => (
                <li key={topic.id}>
                  <Link to={`topic/${topic.id}`} className="topic">
                    {topic.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="message">
            <p>No topics to study yet</p>
          </div>
        )}
      </div>
      <footer>
        <Button href="new-topic">Add Topic</Button>
      </footer>
    </div>
  )
}
