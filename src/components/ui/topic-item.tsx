import { Check } from 'lucide-react'
import { useRef } from 'react'

import { formatTimestamp, getToday, joinNumbers } from '@/lib'
import { Day } from '@/lib/helpers'
import { Topic } from '@/models'

type TopicItemProps = {
  topic: Topic
  isSelectionMode?: boolean
  isSelected: boolean
  onPress: (isPressed: boolean) => void
  onSelect: (topicId: string, add?: boolean) => void
  onOpen: () => void
}

export default function TopicItem({
  topic,
  isSelectionMode = false,
  isSelected = false,
  onPress,
  onSelect,
  onOpen
}: TopicItemProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const { todayLevels } = topic.week[getToday()] as Day

  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => {
      onPress(true)

      if (!isSelected) {
        onSelect(topic.id)
      }
    }, 300) // long press threshold
  }

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleClick = () => {
    if (isSelectionMode) {
      onSelect(topic.id, !isSelected)
      return
    }

    onOpen()
  }

  return (
    <button
      className={`w-full flex justify-between items-center gap-2 p-4 my-4 mx-auto rounded-xl bg-white shadow-sm active:scale-95 transition-transform duration-150 select-none ${
        isSelectionMode && isSelected ? 'ring-2 ring-purple-500' : ''
      }`}
      aria-label={`Go to topic: ${topic.title}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <div className="flex flex-col gap-1.5 text-left w-3/4">
        <span className="text-black font-semibold truncate">{topic.title}</span>
        <span className="text-sm text-gray-700 flex items-center gap-1">
          Today's test{' '}
          {topic.week[getToday()]?.isDone ? (
            <Check size={18} className="-mt-0.5 text-green-600" />
          ) : (
            `: level${todayLevels.length > 1 ? 's' : ''} ${joinNumbers(todayLevels)}`
          )}
        </span>
        <span className="text-xs text-gray-500">
          {`Started on ${formatTimestamp(topic.pivot)}`}
        </span>
      </div>

      <div
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
          isSelectionMode
            ? `${isSelected ? 'bg-purple-600 border-purple-600' : 'bg-gray-300 border-gray-300'}  scale-100 opacity-100`
            : 'bg-gray-300 border-gray-300 scale-0 opacity-0'
        }`}
      >
        {isSelected && (
          <Check
            className="w-4 h-4 text-white transition-transform duration-200"
            strokeWidth={3}
          />
        )}
      </div>
    </button>
  )
}
