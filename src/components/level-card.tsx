import { Check } from 'lucide-react'
import { useRef } from 'react'

import { Card } from '@/models'

type LevelCardProps = {
  card: Card
  isSelected: boolean
  isSelectionMode: boolean
  onPress: (isPressed: boolean) => void
  onSelect: (cardId: string, add?: boolean) => void
  onOpen: () => void
}

export default function LevelCard({
  card,
  isSelected,
  isSelectionMode,
  onOpen,
  onPress,
  onSelect
}: LevelCardProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => {
      onPress(true)

      if (!isSelected) {
        onSelect(card.id)
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
      onSelect(card.id, !isSelected)
      return
    }

    onOpen()
  }

  return (
    <button
      className="relative p-3 w-full h-30 text-xs border-2 border-black
                 rounded-2xl text-black bg-white active:scale-95 transition-transform ease-in-out duration-150 select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <span className="font-bold font-card break-all w-full h-full flex justify-center items-center overflow-hidden">
        {typeof card.data.front === 'string' ? card.data.front : ''}
      </span>

      <div
        className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
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
