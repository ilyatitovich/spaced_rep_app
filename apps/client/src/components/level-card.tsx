import { Check, Volume2 } from 'lucide-react'
import { useRef, useLayoutEffect, useState, type ReactNode } from 'react'

import { isTextHtmlEmpty, normalizeCardData } from '@/lib'
import { Card } from '@/models'
import type { SideBlock } from '@/types'

type LevelCardProps = {
  card: Card
  isSelected: boolean
  isSelectionMode: boolean
  onPress: (isPressed: boolean) => void
  onSelect: (cardId: string, add?: boolean) => void
  onOpen: () => void
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function previewBlock(blocks: SideBlock[]): SideBlock | undefined {
  return (
    blocks.find(block => block.type === 'image') ??
    blocks.find(block => block.type === 'audio') ??
    blocks.find(
      block =>
        (block.type === 'text' && !isTextHtmlEmpty(block.html)) ||
        (block.type === 'code' && block.code.trim().length > 0)
    )
  )
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const front = normalizeCardData(card.data).front
  const block = previewBlock(front.blocks)
  const imageBuffer =
    block?.type === 'image' && 'buffer' in block.content
      ? block.content.buffer
      : undefined
  const imageType =
    block?.type === 'image' && 'buffer' in block.content
      ? block.content.type
      : undefined

  useLayoutEffect(() => {
    if (!imageBuffer || !imageType) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(
      new Blob([imageBuffer], { type: imageType })
    )
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageBuffer, imageType])

  let preview: ReactNode | null = null

  if (block?.type === 'image' && previewUrl) {
    preview = (
      <img
        src={previewUrl}
        alt="front pic"
        className="max-h-full max-w-full object-contain"
      />
    )
  } else if (block?.type === 'audio') {
    preview = <Volume2 className="w-8 h-8" strokeWidth={2} />
  } else if (block?.type === 'text') {
    const text = stripHtml(block.html)
    preview = <p>{text.length > 50 ? text.slice(0, 50) + '...' : text}</p>
  } else if (block?.type === 'code') {
    const text = block.code
    preview = (
      <p className="font-mono text-[10px]">
        {text.length > 50 ? text.slice(0, 50) + '...' : text}
      </p>
    )
  }

  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => {
      onPress(true)

      if (!isSelected) {
        onSelect(card.id)
      }
    }, 700)
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
      className="relative p-3 w-full h-30 text-xs border-2 border-foreground
                 rounded-2xl text-foreground bg-card active:scale-95 transition-transform ease-in-out duration-150 select-none"
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
