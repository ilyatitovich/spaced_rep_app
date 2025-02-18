import './Topic.css'

import { LevelRow, Week } from '@/components'
import { deleteTopic } from '@/lib/db'
import { Topic as TopicType, Level } from '@/models'
import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, useLoaderData } from 'react-router'

export default function Topic() {
  const { topic, today } = useLoaderData<{ topic: TopicType; today: number }>()
  const { id, title, week, levels, draft } = topic

  async function handleDelete(id: string): Promise<void> {
    await deleteTopic(id)
  }

  return (
    <main className="topic">
      <header className="topic__header">
        <nav>
          <Link to="/">Back</Link>
          <h1 className="topic__title">{title}</h1>
          <Link to="/" onClick={() => handleDelete(id)}>
            Delete
          </Link>
        </nav>
      </header>
      <section className="topic__content">
        <Week week={week} today={today} />

        <div className="topic__add-card-wrapper">
          <h2>Levels</h2>
          <Link to="add-card">Add Card</Link>
        </div>

        {draft.length > 0 && (
          <div className="topic__draft-row">
            <Link to="draft">
              <div className="left">Draft</div>
              <div className="right">
                <span>{`${draft.length} cards`}</span>
                <span className="icon">
                  <FontAwesomeIcon icon={faChevronRight} />
                </span>
              </div>
            </Link>
          </div>
        )}

        <div className="topic__levels">
          <ul>
            {levels.map((level: Level) => (
              <LevelRow key={level.id} level={level} />
            ))}
          </ul>
        </div>

        {!week[today]?.isCompleted && (
          <Link to="test" className="topic__today-test-btn">
            <p>Today's Test</p>
          </Link>
        )}
      </section>
    </main>
  )
}
