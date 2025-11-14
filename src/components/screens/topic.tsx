import { useEffect, useState } from 'react'

import { Button, Content, TestButton, LevelRow, Week } from '@/components'
import { Topic, Card } from '@/models'
import { getTopicById, deleteTopic } from '@/services'

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
  const [cards, setCards] = useState<Record<number, Card[]>>({})

  useEffect(() => {
    async function fetchTopic(): Promise<void> {
      try {
        const { topic, cards } = await getTopicById(topicId)
        setTopic(topic)
        setCards(cards)
      } catch (error) {
        console.error('Failed to fetch topic:', error)
      }
    }

    if (!topicId) return
    fetchTopic()
  }, [topicId])

  const handleDeleteTopic = async (): Promise<void> => {
    if (!topic) return
    try {
      await deleteTopic(topic.id)
      onDelete()
      onClose()
    } catch (error) {
      console.error('Failed to delete topic.', error)
    }
  }

  if (!topic) return null

  return (
    <div
      className={`${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
    >
      <div className="relative w-full p-4 flex justify-between items-center border-b border-gray-200">
        <Button onClick={onClose}>Back</Button>
        <span
          className={`
            font-bold
            absolute
            top-1/2
            left-1/2
            -translate-x-1/2
            -translate-y-1/2
            max-w-[160px]
            truncate
            `}
        >
          {topic.title}
        </span>
        <Button onClick={handleDeleteTopic}>Delete</Button>
      </div>

      <Content height={92} className="pb-30">
        <Week week={topic.week} today={today} />

        <div className="flex items-center justify-between py-2">
          <span className="font-bold">Levels</span>
          <Button onClick={() => console.log('add card')}>Add Card</Button>
        </div>

        <ul>
          {topic.levels.map(level => (
            <LevelRow
              key={level.id}
              levelId={level.id}
              cardsNumber={cards[level.id]?.length || 0}
            />
          ))}
        </ul>

        {!topic.week[today]?.isDone && <TestButton onClick={() => null} />}
      </Content>
    </div>
  )
}
