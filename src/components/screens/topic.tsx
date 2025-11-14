import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { Button, Navbar, Content, LevelRow, Week } from '@/components'
import { Topic } from '@/models'
import { getTopicById, deleteTopic } from '@/services'
import { useTopicStore } from '@/stores'

type TopicPageProps = {
  isOpen: boolean
  topicId: string
  onClose: () => void
  onDelete: () => void
}

const today: number = new Date().getDay()

export default function TopicScreen({
  isOpen,
  topicId,
  onClose,
  onDelete
}: TopicPageProps) {
  const [topic, setTopic] = useState<Topic | null>(null)

  const { topicCards, loading, error } = useTopicStore()

  useEffect(() => {
    async function fetchTopic(): Promise<void> {
      try {
        const res = await getTopicById(topicId)
        setTopic(res.topic)
      } catch (error) {
        console.error('Failed to fetch topic:', error)
      }
    }

    if (!topicId) return
    fetchTopic()
  }, [topicId])

  const handleDeleteTopic = async (id: string): Promise<void> => {
    try {
      await deleteTopic(id)
      onDelete()
      onClose()
    } catch (error) {
      console.error('Failed to delete topic.', error)
    }
  }

  if (error) return <p className="text-red">{error}</p>
  if (!topic) return null

  return (
    <div
      className={`${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
    >
      <Navbar>
        <Button onClick={onClose}>Back</Button>
        <h1 className="font-bold">{topic.title}</h1>
        <Button onClick={() => handleDeleteTopic(topic.id)}>Delete</Button>
      </Navbar>
      <Content height={92} className="pb-30" loading={loading}>
        <Week week={topic.week} today={today} />

        <div className="flex items-center justify-between py-2">
          <h2 className="font-bold">Levels</h2>
          <Button href="new-card">Add Card</Button>
        </div>

        <ul>
          {topic.levels.map(level => (
            <LevelRow
              key={level.id}
              levelId={level.id}
              cardsNumber={topicCards[level.id]?.length || 0}
            />
          ))}
        </ul>

        {!topic.week[today]?.isDone && (
          <Link
            to="test"
            className="absolute left-1/2 bottom-4 -translate-x-1/2 w-2/3 py-5 text-center bg-purple text-white rounded-xl"
          >
            <p>Today's Test</p>
          </Link>
        )}
      </Content>
    </div>
  )
}
