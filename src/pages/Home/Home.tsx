import './Home.css'

import { Link, useLoaderData } from 'react-router'

import { Header, Footer } from '@/components'
import type { TopicItem } from '@/types'

export default function Home() {
  const { topics } = useLoaderData<{ topics: TopicItem[] }>()

  return (
    <main className="home">
      <Header withNav={false}>
        <h1>Topics</h1>
      </Header>

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

      <Footer>
        <Link to="add-topic" aria-label="Add a new topic">
          Add Topic
        </Link>
      </Footer>
    </main>
  )
}
