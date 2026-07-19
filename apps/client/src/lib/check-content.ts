/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CardData,
  CodeBlock,
  ImageDBRecord,
  SideContent
} from '@/types'

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

export function isRecord(value: unknown): value is ImageDBRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as any).buffer instanceof ArrayBuffer &&
    typeof (value as any).type === 'string'
  )
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
    if (a.type !== b.type || a.buffer.byteLength !== b.buffer.byteLength) {
      return false
    }
    const left = new Uint8Array(a.buffer)
    const right = new Uint8Array(b.buffer)
    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return false
    }
    return true
  }

  return false
}

export function isCardDataEqual(a: CardData, b: CardData): boolean {
  return (
    a.front.type === b.front.type &&
    a.back.type === b.back.type &&
    isSideContentEqual(a.front.content, b.front.content) &&
    isSideContentEqual(a.back.content, b.back.content)
  )
}
