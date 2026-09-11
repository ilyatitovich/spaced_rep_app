import { sanitizeCardHtml } from '@/lib/sanitize-html'
import type { Card } from '@/models/card.model'
import type { CardSideData } from '@/types'

function isBlankHtml(html: string): boolean {
  if (/<img\b/i.test(html) || /\[sound:/i.test(html)) return false
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim().length === 0
  )
}

function sanitizeSide(side: CardSideData): CardSideData {
  return {
    ...side,
    blocks: side.blocks
      .map(block =>
        block.type === 'text'
          ? { type: 'text' as const, html: sanitizeCardHtml(block.html) }
          : block
      )
      .filter(block => block.type !== 'text' || !isBlankHtml(block.html))
  }
}

/** DOMPurify on main thread after worker mapping. */
export function sanitizeImportedCard(card: Card): void {
  card.data = {
    front: sanitizeSide(card.data.front),
    back: sanitizeSide(card.data.back)
  }
}
