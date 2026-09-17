import DOMPurify from 'dompurify'
import { resolveCodeLang } from '../../../client/src/lib/code-lang'
import type { CapturedContent, SideBlock } from '../types'

export type RawCapture = {
  html?: string
  text?: string
  code?: string
  imageUrl?: string
  audioUrl?: string
  title: string
  url: string
}

export async function fetchMedia(
  url: string
): Promise<{ buffer: ArrayBuffer; type: string }> {
  let response = await fetch(url)
  if (!response.ok) {
    const origin = `${new URL(url).origin}/*`
    const granted = await chrome.permissions.request({ origins: [origin] })
    if (!granted) throw new Error('Permission to read this media was denied')
    response = await fetch(url)
  }
  if (!response.ok) throw new Error(`Could not read media (${response.status})`)
  return {
    buffer: await response.arrayBuffer(),
    type: response.headers.get('content-type') ?? ''
  }
}

export async function normalizeCapture(
  raw: RawCapture
): Promise<CapturedContent> {
  const blocks: SideBlock[] = []
  if (raw.code?.trim()) {
    const hint = raw.html?.match(/language-([\w-]+)/i)?.[1] ?? ''
    blocks.push({
      type: 'code',
      lang: resolveCodeLang(hint, raw.code),
      code: raw.code.trim()
    })
  } else if (raw.html?.trim() || raw.text?.trim()) {
    const html = DOMPurify.sanitize(raw.html || raw.text || '', {
      ALLOWED_TAGS: [
        'b',
        'br',
        'code',
        'em',
        'i',
        'li',
        'ol',
        'p',
        'pre',
        'strong',
        'u',
        'ul'
      ],
      ALLOWED_ATTR: []
    })
    if (html.trim()) blocks.push({ type: 'text', html })
  }
  if (raw.imageUrl) {
    try {
      blocks.push({ type: 'image', content: await fetchMedia(raw.imageUrl) })
    } catch {
      blocks.push({ type: 'image', content: { src: raw.imageUrl } })
    }
  }
  if (raw.audioUrl) {
    blocks.push({ type: 'audio', content: await fetchMedia(raw.audioUrl) })
  }
  if (blocks.length) {
    const source = DOMPurify.sanitize(
      `<p>Source: ${raw.title || raw.url} — ${raw.url}</p>`,
      { ALLOWED_TAGS: ['p'], ALLOWED_ATTR: [] }
    )
    blocks.push({ type: 'text', html: source })
  }
  return { blocks, source: { title: raw.title, url: raw.url } }
}
