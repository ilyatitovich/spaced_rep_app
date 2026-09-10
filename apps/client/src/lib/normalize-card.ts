import type {
  CardData,
  CardSideData,
  CodeBlock,
  ImageDBRecord,
  LegacyCardData,
  LegacyCardSideData,
  SideBlock,
  SideName
} from '@/types'

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function isSideName(value: unknown): value is SideName {
  return value === 'front' || value === 'back'
}

function isImageRecord(value: unknown): value is ImageDBRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ImageDBRecord).buffer instanceof ArrayBuffer &&
    typeof (value as ImageDBRecord).type === 'string'
  )
}

function isCodeBlock(value: unknown): value is CodeBlock {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CodeBlock).lang === 'string' &&
    typeof (value as CodeBlock).code === 'string'
  )
}

function isSideBlock(value: unknown): value is SideBlock {
  if (typeof value !== 'object' || value === null) return false
  const block = value as SideBlock
  if (block.type === 'text') return typeof block.html === 'string'
  if (block.type === 'image' || block.type === 'audio') {
    return (
      isImageRecord(block.content) &&
      (block.caption === undefined || typeof block.caption === 'string')
    )
  }
  return false
}

function isBlocksSide(value: unknown): value is CardSideData {
  return (
    typeof value === 'object' &&
    value !== null &&
    isSideName((value as CardSideData).side) &&
    Array.isArray((value as CardSideData).blocks) &&
    (value as CardSideData).blocks.every(isSideBlock)
  )
}

function isLegacySide(value: unknown): value is LegacyCardSideData {
  if (typeof value !== 'object' || value === null) return false
  const side = value as LegacyCardSideData
  if (!isSideName(side.side)) return false
  if (side.type === 'text') return typeof side.content === 'string'
  if (side.type === 'image') return isImageRecord(side.content)
  if (side.type === 'code') return isCodeBlock(side.content)
  return false
}

function legacyToBlocks(side: LegacyCardSideData): SideBlock[] {
  if (side.type === 'text') {
    return [{ type: 'text', html: escapeHtml(side.content as string) }]
  }

  if (side.type === 'image') {
    return [{ type: 'image', content: side.content as ImageDBRecord }]
  }

  const { lang, code } = side.content as CodeBlock
  return [
    {
      type: 'text',
      html: `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`
    }
  ]
}

/** Convert a legacy exclusive side or pass through an already-normalized blocks side. */
export function normalizeSide(
  side: unknown,
  fallbackSide: SideName = 'front'
): CardSideData {
  if (isBlocksSide(side)) {
    return { side: side.side, blocks: side.blocks }
  }

  if (isLegacySide(side)) {
    return { side: side.side, blocks: legacyToBlocks(side) }
  }

  return { side: fallbackSide, blocks: [] }
}

export function normalizeCardData(data: unknown): CardData {
  if (typeof data === 'object' && data !== null) {
    const record = data as Partial<LegacyCardData & CardData>
    return {
      front: normalizeSide(record.front, 'front'),
      back: normalizeSide(record.back, 'back')
    }
  }

  return {
    front: { side: 'front', blocks: [] },
    back: { side: 'back', blocks: [] }
  }
}
