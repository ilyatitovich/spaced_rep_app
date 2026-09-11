import { normalizeSide } from '@/lib/normalize-card'
import { Card } from '@/models/card.model'
import type { CardData, SideBlock, SideName } from '@/types'
import type { AnkiMediaFile, ParsedAnkiNote, ParsedApkg } from './parse-apkg'

const SOUND_RE = /\[sound:([^\]]+)\]/gi
const IMG_RE = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi
const CLOZE_RE = /\{\{c\d+::(.*?)(?:::[^}]*)?\}\}/gs

type MediaHit = {
  index: number
  end: number
  kind: 'image' | 'audio'
  name: string
}

/** `{{c1::answer}}` / `{{c1::answer::hint}}` → blank for the question side. */
export function clozeToBlank(html: string): string {
  return html.replace(CLOZE_RE, '___')
}

/** Reveal cloze answers (first alternative before `|`). */
export function clozeToAnswer(html: string): string {
  return html.replace(CLOZE_RE, (_, answer: string) => answer.split('|')[0] ?? '')
}

function isBlankHtml(html: string): boolean {
  if (/<img\b/i.test(html) || /\[sound:/i.test(html)) return false
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim().length === 0
  )
}

function collectMediaHits(html: string): MediaHit[] {
  const hits: MediaHit[] = []

  for (const match of html.matchAll(IMG_RE)) {
    if (match.index === undefined) continue
    hits.push({
      index: match.index,
      end: match.index + match[0].length,
      kind: 'image',
      name: match[1] ?? ''
    })
  }

  for (const match of html.matchAll(SOUND_RE)) {
    if (match.index === undefined) continue
    hits.push({
      index: match.index,
      end: match.index + match[0].length,
      kind: 'audio',
      name: match[1] ?? ''
    })
  }

  hits.sort((a, b) => a.index - b.index)
  return hits
}

function pushText(blocks: SideBlock[], html: string) {
  if (!html || isBlankHtml(html)) return
  blocks.push({ type: 'text', html })
}

function isRemoteImageUrl(name: string): boolean {
  return /^https?:\/\//i.test(name) || name.startsWith('//')
}

function pushMedia(
  blocks: SideBlock[],
  kind: 'image' | 'audio',
  name: string,
  mediaByName: Map<string, AnkiMediaFile>
) {
  if (kind === 'image' && isRemoteImageUrl(name)) {
    blocks.push({ type: 'image', content: { src: name } })
    return
  }
  const file = mediaByName.get(name)
  if (!file) {
    // Keep a plain reference so the learner still sees something was there.
    pushText(blocks, kind === 'audio' ? `[sound:${name}]` : name)
    return
  }
  blocks.push({ type: kind, content: { buffer: file.buffer, type: file.type } })
}

/** Split one Anki field into ordered SideBlocks (media extracted; captions omitted). */
export function fieldHtmlToBlocks(
  html: string,
  mediaByName: Map<string, AnkiMediaFile>
): SideBlock[] {
  const hits = collectMediaHits(html)
  const blocks: SideBlock[] = []
  let cursor = 0

  for (const hit of hits) {
    if (hit.index < cursor) continue
    pushText(blocks, html.slice(cursor, hit.index))
    pushMedia(blocks, hit.kind, hit.name, mediaByName)
    cursor = hit.end
  }

  pushText(blocks, html.slice(cursor))
  return blocks
}

function finalizeSide(
  side: SideName,
  html: string | undefined,
  mediaByName: Map<string, AnkiMediaFile>
) {
  // Sanitize on main (DOMPurify); worker must not import DOM.
  const raw = fieldHtmlToBlocks(html ?? '', mediaByName)
  const normalized = normalizeSide({ side, blocks: raw })
  return {
    side,
    blocks: normalized.blocks.filter(
      block => block.type !== 'text' || !isBlankHtml(block.html)
    )
  }
}

function joinHtmlParts(parts: Array<string | undefined>): string {
  return parts.filter(part => part && !isBlankHtml(part)).join('<br>')
}

function namedFields(
  fields: string[],
  fieldNames: string[]
): Map<string, string> {
  const map = new Map<string, string>()
  fieldNames.forEach((name, i) => {
    if (!name) return
    map.set(name.toLowerCase(), fields[i] ?? '')
  })
  return map
}

/**
 * Pick front/back HTML from Anki fields.
 * Basic → Front/Back; Cloze-like → Question/Text (+ Rubric/Image/Audio/Choices).
 */
export function pickFrontBackHtml(
  fields: string[],
  fieldNames: string[] = []
): { front: string; back: string } {
  const named = namedFields(fields, fieldNames)

  if (named.has('front') || named.has('back')) {
    return {
      front: named.get('front') ?? '',
      back: named.get('back') ?? ''
    }
  }

  const question = named.get('question') ?? named.get('text')
  if (question !== undefined) {
    const lead = [
      named.get('rubric'),
      named.get('image'),
      named.get('audio')
    ]
    return {
      front: joinHtmlParts([
        ...lead,
        clozeToBlank(question),
        named.get('choices')
      ]),
      back: joinHtmlParts([
        ...lead,
        clozeToAnswer(question),
        named.get('audiotext'),
        named.get('extra')
      ])
    }
  }

  return {
    front: clozeToBlank(fields[0] ?? ''),
    back: clozeToAnswer(fields[1] ?? fields[0] ?? '')
  }
}

/** Map Anki note fields → CardData using note-type field names when available. */
export function noteFieldsToCardData(
  fields: string[],
  mediaByName: Map<string, AnkiMediaFile>,
  fieldNames: string[] = []
): CardData {
  const { front, back } = pickFrontBackHtml(fields, fieldNames)
  return {
    front: finalizeSide('front', front, mediaByName),
    back: finalizeSide('back', back, mediaByName)
  }
}

export function noteToCard(
  note: ParsedAnkiNote,
  topicId: string,
  mediaByName: Map<string, AnkiMediaFile>
): Card {
  return new Card(
    noteFieldsToCardData(note.fields, mediaByName, note.fieldNames),
    topicId,
    0
  )
}

/** Parse result → Card instances at Draft (level 0) with fresh UUIDs. */
export function apkgToCards(parsed: ParsedApkg, topicId: string): Card[] {
  return parsed.notes
    .map(note => noteToCard(note, topicId, parsed.mediaByName))
    .filter(
      card =>
        card.data.front.blocks.length > 0 || card.data.back.blocks.length > 0
    )
}
