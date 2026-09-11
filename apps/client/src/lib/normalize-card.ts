import type { CodeLang } from './code-lang'
import type {
  CardData,
  CardSideData,
  CodeBlock,
  MediaDBRecord,
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

function decodeEntities(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
}

function isSideName(value: unknown): value is SideName {
  return value === 'front' || value === 'back'
}

function isImageRecord(value: unknown): value is MediaDBRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as MediaDBRecord).buffer instanceof ArrayBuffer &&
    typeof (value as MediaDBRecord).type === 'string'
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

function toCodeLang(raw: string | undefined): CodeLang {
  const lang = (raw ?? 'ts').toLowerCase()
  if (lang === 'python' || lang === 'py') return 'py'
  if (lang === 'typescript' || lang === 'ts') return 'ts'
  if (lang === 'javascript' || lang === 'js') return 'js'
  if (lang === 'sql') return 'sql'
  if (lang === 'bash' || lang === 'sh' || lang === 'shell') return 'sh'
  return 'ts'
}

const FENCE_RE =
  /<pre[^>]*>\s*<code(?:\s+class="language-([^"]*)")?[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi

/** Pull HTML code fences out of a text block into sibling `code` blocks. */
export function splitTextAndCodeBlocks(html: string): SideBlock[] {
  const blocks: SideBlock[] = []
  let last = 0
  const re = new RegExp(FENCE_RE.source, 'gi')
  let match: RegExpExecArray | null

  while ((match = re.exec(html)) !== null) {
    const before = html.slice(last, match.index)
    if (before.replace(/<[^>]*>/g, '').trim() || before.includes('<img')) {
      blocks.push({ type: 'text', html: before })
    } else if (before.trim()) {
      blocks.push({ type: 'text', html: before })
    }
    blocks.push({
      type: 'code',
      lang: toCodeLang(match[1]),
      code: decodeEntities(match[2] ?? '')
    })
    last = match.index + match[0].length
  }

  const after = html.slice(last)
  if (after.trim() || blocks.length === 0) {
    blocks.push({ type: 'text', html: after || html })
  }

  return blocks.length ? blocks : [{ type: 'text', html }]
}

function isSideBlock(value: unknown): value is SideBlock {
  if (typeof value !== 'object' || value === null) return false
  const block = value as SideBlock
  if (block.type === 'text') return typeof block.html === 'string'
  if (block.type === 'code') {
    return typeof block.lang === 'string' && typeof block.code === 'string'
  }
  if (block.type === 'image' || block.type === 'audio') {
    return isImageRecord(block.content)
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
    return [{ type: 'image', content: side.content as MediaDBRecord }]
  }

  const { lang, code } = side.content as CodeBlock
  return [{ type: 'code', lang, code }]
}

function expandEmbeddedCode(blocks: SideBlock[]): SideBlock[] {
  return blocks.flatMap(block => {
    if (block.type !== 'text' || !/<pre[\s>]/i.test(block.html)) {
      return [block]
    }
    return splitTextAndCodeBlocks(block.html)
  })
}

/** Stored `caption` on media → sibling text block. */
function liftMediaCaptions(blocks: SideBlock[]): SideBlock[] {
  const next: SideBlock[] = []
  for (const block of blocks) {
    if (block.type !== 'image' && block.type !== 'audio') {
      next.push(block)
      continue
    }
    next.push({ type: block.type, content: block.content })
    const caption = (block as { caption?: unknown }).caption
    if (typeof caption !== 'string' || !caption.trim()) continue
    next.push({
      type: 'text',
      html: `<p>${escapeHtml(caption.trim())}</p>`
    })
  }
  return next
}

/** Convert a legacy exclusive side or pass through an already-normalized blocks side. */
export function normalizeSide(
  side: unknown,
  fallbackSide: SideName = 'front'
): CardSideData {
  if (isBlocksSide(side)) {
    return {
      side: side.side,
      blocks: liftMediaCaptions(expandEmbeddedCode(side.blocks))
    }
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
