import './Topic.scss'

import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, LoaderFunctionArgs, useLoaderData } from 'react-router'

import LevelRow from '../../components/LevelRow/LevelRow'
import Week from '../../components/Week/Week'
import { Topic as TopicType, Level } from '../../lib/definitions'
import { getTopic, updateWeek } from '../../lib/utils'

export async function loader({ params }: LoaderFunctionArgs) {
  let topic = getTopic(params.topicId!)
  const today: number = new Date().getDay()

  // update week if update day has passed
  if (topic.nextUpdateDate <= Date.now()) {
    topic = updateWeek(topic)
  }

  return { topic, today }
}

export default function Topic() {
  const { topic, today } = useLoaderData() as {
    topic: TopicType
    today: number
  }
  const { id, title, week, levels, draft } = topic

  function handleDelete(id: string) {
    localStorage.removeItem(id)
  }

  return (
    <div className="topic">
      <nav>
        <Link to="/">Back</Link>
        <p className="title">{title}</p>
        <Link to="/" onClick={() => handleDelete(id)}>
          Delete
        </Link>
      </nav>
      <div className="content">
        <Week week={week} today={today} />

        <div className="add-card-wrapper">
          <h4>Levels</h4>
          <Link to="new-card">Add Card</Link>
        </div>

        {draft.length > 0 && (
          <div className="draft-row">
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

        <div className="levels">
          <ul>
            {levels.map((level: Level) => (
              <LevelRow key={level.id} level={level} />
            ))}
          </ul>
        </div>

        {!week[today]?.isDone && (
          <Link to="test" className="today-test-btn">
            <h4>Today's Test</h4>
          </Link>
        )}
      </div>
    </div>
  )
}
