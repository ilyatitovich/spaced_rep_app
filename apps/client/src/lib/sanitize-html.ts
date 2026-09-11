import DOMPurify from 'dompurify'

/** Notes-style text: formatting + lists. Code lives in sibling `code` blocks. */
const ALLOWED_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  'br',
  'p',
  'div',
  'span',
  'ul',
  'ol',
  'li'
]

const ALLOWED_ATTR: string[] = []

/** Sanitize rich-text HTML for card text blocks. */
export function sanitizeCardHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false
  })
}
