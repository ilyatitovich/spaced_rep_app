import './Home.css'

import type { TopicItem } from '@/types'
import { Link, useLoaderData } from 'react-router'

export default function Home() {
  const { topics } = useLoaderData<{ topics: TopicItem[] }>()

  return (
    <main className="home">
      <header className="home__header">
        <h1>Topics</h1>
      </header>

      <section className="home__content">
        {topics.length > 0 ? (
          <ul className="home__topics-list">
            {topics.map(topic => (
              <li key={topic.id}>
                <Link
                  to={`topic/${topic.id}`}
                  className="home__topic-item"
                  aria-label={`Go to topic: ${topic.title}`}
                >
                  {topic.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="home__message">No topics to study yet</p>
        )}
      </section>

      <footer>
        <Link to="new-topic" aria-label="Add a new topic">
          Add Topic
        </Link>
      </footer>
    </main>
  )
}
