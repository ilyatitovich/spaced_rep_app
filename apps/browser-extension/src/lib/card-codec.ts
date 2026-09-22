import { arrayBufferToBase64, base64ToArrayBuffer } from '@/lib/image'
import type { CardData, SideBlock } from '../types'

export function emptyCardData(): CardData {
  return {
    front: { side: 'front', blocks: [{ type: 'text', html: '' }] },
    back: { side: 'back', blocks: [{ type: 'text', html: '' }] }
  }
}

function encodeBlock(block: SideBlock): unknown {
  if (block.type === 'text' || block.type === 'code') return block
  if ('src' in block.content) return block
  return { ...block, content: arrayBufferToBase64(block.content) }
}

export function encodeCardData(data: CardData): unknown {
  return {
    front: { ...data.front, blocks: data.front.blocks.map(encodeBlock) },
    back: { ...data.back, blocks: data.back.blocks.map(encodeBlock) }
  }
}

export function decodeCardData(data: unknown): CardData {
  const value = data as CardData
  const decode = (block: SideBlock): SideBlock => {
    if (block.type === 'text' || block.type === 'code') return block
    if ('src' in block.content || block.content.buffer instanceof ArrayBuffer) {
      return block
    }
    return {
      ...block,
      content: base64ToArrayBuffer(
        block.content as unknown as { buffer: string; type: string }
      )
    }
  }
  return {
    front: { ...value.front, blocks: value.front.blocks.map(decode) },
    back: { ...value.back, blocks: value.back.blocks.map(decode) }
  }
}
