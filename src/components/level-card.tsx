import { Check } from 'lucide-react'
import { useRef, useEffect, useState, ReactNode } from 'react'

import { iosLog, isCodeBlock } from '@/lib'
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
  const [previewUrl, setPreviewUrl] = useState('')
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const { content: frontContent } = card.data.front

  let preview: ReactNode | null = null

  useEffect(() => {
    if (typeof frontContent !== 'string' && !isCodeBlock(frontContent)) {
      const url = URL.createObjectURL(frontContent)
      setPreviewUrl(url)

      return () => {
        URL.revokeObjectURL(url)
      }
    }
  }, [frontContent])

  if (typeof frontContent === 'string') {
    preview = (
      <p>
        {frontContent.length > 50
          ? frontContent.slice(0, 50) + '...'
          : frontContent}
      </p>
    )
  }

  if (isCodeBlock(frontContent)) {
    preview = (
      <p className="font-mono text-[10px]">
        {frontContent.code.length > 50
          ? frontContent.code.slice(0, 50) + '...'
          : frontContent.code}
      </p>
    )
  }

  if (frontContent instanceof Blob) {
    iosLog(previewUrl)
    preview = previewUrl && (
      <img
        src={previewUrl}
        alt="front pic"
        onLoad={() => iosLog('Изображение отобразилось!')}
        onError={e => iosLog('Ошибка загрузки изображения:', e)}
      />
    )
  }

  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => {
      onPress(true)

      if (!isSelected) {
        onSelect(card.id)
      }
    }, 700) // long press threshold
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
        {preview}
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
