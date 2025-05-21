import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect } from 'react'
import { Link, useLoaderData } from 'react-router'

import { Button, Navbar, Content, LevelRow, Week } from '@/components'
import { Topic as TopicType, Level } from '@/lib/definitions'
import { useTopicStore } from '@/stores'

export default function Topic() {
  const { topic, today } = useLoaderData() as {
    topic: TopicType
    today: number
  }

  const setTopic = useTopicStore(state => state.setTopic)

  useEffect(() => {
    setTopic(topic)
  }, [topic, setTopic])

  const { id, title, week, levels, draft } = topic

  function handleDelete(id: string) {
    localStorage.removeItem(id)
  }

  return (
    <main>
      <Navbar>
        <Button href="/">Back</Button>
        <h1 className="title">{title}</h1>
        <Button href="/" onClick={() => handleDelete(id)}>
          Delete
        </Button>
      </Navbar>

      <Content height={92} className="pb-30">
        <Week week={week} today={today} />

        <div className="flex items-center justify-between py-2">
          <h4>Levels</h4>
          <Button href="new-card">Add Card</Button>
        </div>

        {draft.length > 0 && (
          <div className="py-4 border-b border-light-gray">
            <Link to="draft" className="flex items-center justify-between">
              <span>Draft</span>
              <span className="flex items-center gap-2 text-gray">
                <span>{`${draft.length} cards`}</span>
                <span className="text-sm">
                  <FontAwesomeIcon icon={faChevronRight} />
                </span>
              </span>
            </Link>
          </div>
        )}

        <ul>
          {levels.map((level: Level) => (
            <LevelRow key={level.id} level={level} />
          ))}
        </ul>

        {!week[today]?.isDone && (
          <Link
            to="test"
            className="absolute left-1/2 bottom-4 -translate-x-1/2 w-2/3 py-5 text-center bg-purple text-white rounded-xl"
          >
            <p>Today's Test</p>
          </Link>
        )}
      </Content>
    </main>
  )
}
