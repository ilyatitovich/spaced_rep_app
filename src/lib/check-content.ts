/* eslint-disable @typescript-eslint/no-explicit-any */
import { CodeBlock } from '@/types'

export function isContentEmpty(
  content: string | Blob | null | undefined | CodeBlock
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
