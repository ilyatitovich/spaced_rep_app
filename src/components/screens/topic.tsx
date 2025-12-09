import { Settings } from 'lucide-react'
import { useRef } from 'react'

import {
  TestButton,
  LevelRow,
  Week,
  BackButton,
  Header,
  Screen
} from '@/components'
import { OpenButton } from '@/components'
import { getToday, LEVELS } from '@/lib'
import { useTopicStore, useScreenStore } from '@/stores'

export default function TopicScreen() {
  const topic = useTopicStore(s => s.topic)
  const cards = useTopicStore(s => s.cards)
  const isOpen = useScreenStore(s => s.isTopicOpen)

  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span>{topic?.title}</span>
        <OpenButton screen="topicSettings">
          <Settings />
        </OpenButton>
      </Header>

      {topic && (
        <div ref={contentRef} className="h-[92dvh] p-4 pb-30 overflow-y-auto">
          <Week week={topic.week} />

          <div className="flex items-center justify-between mt-10 py-2">
            <span className="font-bold">Levels</span>
            <OpenButton screen="addCard">Add Card</OpenButton>
          </div>

          <ul>
            {LEVELS.map(level => (
              <LevelRow
                key={level}
                levelId={level}
                cardsNumber={cards[level]?.length ?? 0}
              />
            ))}
          </ul>

          {!topic.week[getToday()]?.isDone && (
            <TestButton todayLevels={topic.week[getToday()]!.todayLevels} />
          )}
        </div>
      )}
    </Screen>
  )
}
