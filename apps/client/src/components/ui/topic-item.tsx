import { Check } from 'lucide-react'

import { formatTimestamp, getToday, joinNumbers } from '@/lib'
import { Topic, Day } from '@/models'

type TopicItemProps = {
  topic: Topic
  isSelectionMode?: boolean
  isSelected: boolean
  onSelect: (topicId: string, add?: boolean) => void
  onOpen: () => void
}

export default function TopicItem({
  topic,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  onOpen
}: TopicItemProps) {
  const { todayLevels } = topic.week[getToday()] as Day

  const handleClick = () => {
    if (isSelectionMode) {
      onSelect(topic.id, !isSelected)
      return
    }

    onOpen()
  }

  return (
    <button
      className={`w-full flex justify-between items-center gap-2 p-4 my-4 mx-auto rounded-xl bg-card shadow-sm active:scale-95 transition-transform duration-150 select-none ${
        isSelectionMode && isSelected ? 'ring-2 ring-primary' : ''
      }`}
      aria-label={`Go to topic: ${topic.title}`}
      onClick={handleClick}
    >
      <div className="flex flex-col gap-1.5 text-left w-3/4">
        <span className="text-foreground font-semibold truncate">
          {topic.title}
        </span>
        <span className="text-sm text-foreground flex items-center gap-1">
          Today's test
          {topic.week[getToday()]?.isDone ? (
            <Check size={18} className="-mt-0.5 text-success" />
          ) : (
            `: level${todayLevels.length > 1 ? 's' : ''} ${joinNumbers(todayLevels)}`
          )}
        </span>
        <span className="text-xs text-foreground-muted">
          {`Started on ${formatTimestamp(topic.pivot)}`}
        </span>
      </div>

      <div
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
          isSelectionMode
            ? `${isSelected ? 'bg-primary border-primary' : 'bg-secondary border-border'}  scale-100 opacity-100`
            : 'bg-secondary border-border scale-0 opacity-0'
        }`}
      >
        {isSelected && (
          <Check
            className="w-4 h-4 text-primary-foreground transition-transform duration-200"
            strokeWidth={3}
          />
        )}
      </div>
    </button>
  )
}
