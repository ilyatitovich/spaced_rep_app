import { Trash2 } from 'lucide-react'

import { isTextHtmlEmpty } from '@/lib/check-content'
import { arrayBufferToBase64 } from '@/lib/image'
import { decodeCardData } from '@ext/lib/card-codec'
import type { Card, SideBlock } from '@ext/types'

function firstBlock(blocks: SideBlock[]) {
  return (
    blocks.find(block => block.type === 'image') ??
    blocks.find(
      block =>
        (block.type === 'text' && !isTextHtmlEmpty(block.html)) ||
        (block.type === 'code' && block.code.trim().length > 0) ||
        block.type === 'audio'
    )
  )
}

function preview(block: SideBlock | undefined) {
  if (!block) return { text: 'Empty card' }
  if (block.type === 'text') {
    const text = block.html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
    return { text: text.length > 50 ? `${text.slice(0, 50)}…` : text }
  }
  if (block.type === 'code') {
    const text = block.code.trim()
    return {
      text: text.length > 50 ? `${text.slice(0, 50)}…` : text,
      isCode: true
    }
  }
  if (block.type === 'image') {
    if ('src' in block.content) return { src: block.content.src }
    const encoded = arrayBufferToBase64(block.content)
    return { src: `data:${encoded.type};base64,${encoded.buffer}` }
  }
  return { text: 'Audio' }
}

export default function CardRow({
  card,
  onOpen,
  onDelete
}: {
  card: Card
  onOpen: () => void
  onDelete: () => void
}) {
  const shown = preview(firstBlock(decodeCardData(card.data).front.blocks))
  return (
    <div className="flex items-center gap-2 border-b border-border">
      <button
        className="flex-1 min-w-0 py-2 text-left text-sm truncate"
        onClick={onOpen}
      >
        {shown.src ? (
          <img src={shown.src} alt="" className="h-10 object-contain" />
        ) : (
          <span className={shown.isCode ? 'font-mono' : undefined}>
            {shown.text}
          </span>
        )}
      </button>
      <button title="Delete card" className="p-2 text-danger" onClick={onDelete}>
        <Trash2 size={16} />
      </button>
    </div>
  )
}
