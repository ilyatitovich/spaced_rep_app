/* eslint-disable @typescript-eslint/no-explicit-any */
import { CodeBlock, ImageDBRecord, SideContent } from '@/types'

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
