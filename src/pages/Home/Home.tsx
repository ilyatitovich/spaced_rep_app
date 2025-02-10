import './Home.css'

import type { TopicItem } from '@/types'
import { Link, useLoaderData } from 'react-router'

export default function Home() {
  const { topics } = useLoaderData<{ topics: TopicItem[] }>()

  return (
    <main className="home">
      <nav>
        <p>Topics</p>
      </nav>
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
        <Link to="new-topic">Add Topic</Link>
      </footer>
    </main>
  )
}
