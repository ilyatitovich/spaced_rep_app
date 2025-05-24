import { useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router'

import { Button, Navbar, Content, LevelRow, Week } from '@/components'
import { Level } from '@/lib/helpers'
import { useTopicStore } from '@/stores'

export default function TopicPage() {
  const navigate = useNavigate()
  const { topicId } = useParams()

  const { currentTopic, fetchTopic, deleteTopicById, loading, error } =
    useTopicStore()

  const today: number = new Date().getDay()

  useEffect(() => {
    if (!currentTopic) {
      fetchTopic(topicId!)
    }
  }, [fetchTopic, topicId, currentTopic])

  const handleDeleteTopic = async (id: string) => {
    try {
      await deleteTopicById(id)
      navigate('/')
    } catch (error) {
      console.error('Failed to delete topic.', error)
    }
  }

  if (loading) return <p>Loading...</p>
  if (error) return <p className="text-red">{error}</p>
  if (!currentTopic) return null

  return (
    <main>
      <Navbar>
        <Button href="/">Back</Button>
        <h1 className="font-bold">{currentTopic.title}</h1>
        <Button onClick={() => handleDeleteTopic(currentTopic.id)}>
          Delete
        </Button>
      </Navbar>

      <Content height={92} className="pb-30">
        <Week week={currentTopic.week} today={today} />

        <div className="flex items-center justify-between py-2">
          <h2 className="font-bold">Levels</h2>
          <Button href="new-card">Add Card</Button>
        </div>

        <ul>
          {currentTopic.levels.map((level: Level) => (
            <LevelRow key={level.id} level={level} />
          ))}
        </ul>

        {!currentTopic.week[today]?.isDone && (
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
