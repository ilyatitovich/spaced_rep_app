/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  CardData,
  CardSideData,
  CodeBlock,
  MediaDBRecord,
  LegacyCardData,
  SideBlock,
  SideContent
} from '@/types'

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

export function isTextHtmlEmpty(html: string): boolean {
  return stripHtml(html).length === 0
}

export function isBlockEmpty(block: SideBlock): boolean {
  if (block.type === 'text') return isTextHtmlEmpty(block.html)
  if (block.type === 'code') return block.code.trim().length === 0
  if ('src' in block.content) return block.content.src.trim().length === 0
  return block.content.buffer.byteLength === 0
}

export function isSideEmpty(side: CardSideData): boolean {
  return side.blocks.length === 0 || side.blocks.every(isBlockEmpty)
}

/** Drop a trailing empty text so adding code/media doesn't leave a blank editor. */
export function appendSideBlocks(
  existing: SideBlock[],
  incoming: SideBlock[]
): SideBlock[] {
  const last = existing.at(-1)
  const base =
    last?.type === 'text' && isTextHtmlEmpty(last.html)
      ? existing.slice(0, -1)
      : existing
  return [...base, ...incoming]
}

/** True when a block was added at the end (including empty text replaced by code/media). */
export function didAppendSideBlock(
  prev: SideBlock[],
  next: SideBlock[]
): boolean {
  if (next.length > prev.length) return true
  return (
    next.length === prev.length &&
    next.length > 0 &&
    prev.at(-1)?.type === 'text' &&
    next.at(-1)?.type !== 'text'
  )
}

/** @deprecated Prefer isSideEmpty / isBlockEmpty for blocks sides. */
export function isContentEmpty(
  content: null | undefined | SideContent
): boolean {
  if (content == null) return true

  if (typeof content === 'string') {
    return content.trim().length === 0
  }

  if (content instanceof Blob) {
    return content.size === 0
  }

  if (isCodeBlock(content)) {
    return content.code.trim().length === 0
  }

  if (isRecord(content)) {
    return content.buffer.byteLength === 0
  }

  return true
}

export function isCodeBlock(value: unknown): value is CodeBlock {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).lang === 'string' &&
    typeof (value as any).code === 'string'
  )
}

export function isRecord(value: unknown): value is MediaDBRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as any).buffer instanceof ArrayBuffer &&
    typeof (value as any).type === 'string'
  )
}

function isBufferEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false
  const left = new Uint8Array(a)
  const right = new Uint8Array(b)
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

function isBlockEqual(a: SideBlock, b: SideBlock): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'text' && b.type === 'text') {
    return a.html.trim() === b.html.trim()
  }
  if (a.type === 'code' && b.type === 'code') {
    return a.lang === b.lang && a.code === b.code
  }
  if (
    (a.type === 'image' || a.type === 'audio') &&
    (b.type === 'image' || b.type === 'audio')
  ) {
    if (a.type !== b.type) return false
    if ('src' in a.content || 'src' in b.content) {
      return (
        'src' in a.content &&
        'src' in b.content &&
        a.content.src === b.content.src
      )
    }
    return (
      a.content.type === b.content.type &&
      isBufferEqual(a.content.buffer, b.content.buffer)
    )
  }
  return false
}

function isSideBlocksEqual(a: CardSideData, b: CardSideData): boolean {
  if (a.blocks.length !== b.blocks.length) return false
  return a.blocks.every((block, i) => isBlockEqual(block, b.blocks[i]!))
}

function isSideContentEqual(a: SideContent, b: SideContent): boolean {
  if (a === b) return true

  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim() === b.trim()
  }

  if (a instanceof Blob && b instanceof Blob) {
    return a.size === b.size && a.type === b.type
  }

  if (isCodeBlock(a) && isCodeBlock(b)) {
    return a.lang === b.lang && a.code === b.code
  }

  if (isRecord(a) && isRecord(b)) {
    return a.type === b.type && isBufferEqual(a.buffer, b.buffer)
  }

  return false
}

export function isCardDataEqual(a: CardData, b: CardData): boolean {
  return (
    isSideBlocksEqual(a.front, b.front) && isSideBlocksEqual(a.back, b.back)
  )
}

/** @deprecated Legacy exclusive sides only. */
export function isLegacyCardDataEqual(
  a: LegacyCardData,
  b: LegacyCardData
): boolean {
  return (
    a.front.type === b.front.type &&
    a.back.type === b.back.type &&
    isSideContentEqual(a.front.content, b.front.content) &&
    isSideContentEqual(a.back.content, b.back.content)
  )
}
