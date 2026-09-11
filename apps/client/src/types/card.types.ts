import type { CodeLang } from '@/lib'

export type SideName = 'front' | 'back'

export type MediaDBRecord = { buffer: ArrayBuffer; type: string }

/** Remote Anki img URL kept on the card until cached on open. */
export type RemoteImageContent = { src: string }

export type ImageContent = MediaDBRecord | RemoteImageContent

export type ImageBase64Record = { buffer: string; type: string }

/** Code snippet (legacy exclusive side content, or `type: 'code'` block). */
export type CodeBlock = {
  lang: CodeLang
  code: string
}

/** @deprecated Exclusive side content; use SideBlock list. */
export type SideContent = string | Blob | CodeBlock | MediaDBRecord

/** @deprecated Exclusive side modes; use SideBlock.type. */
export type SideContentType = 'text' | 'image' | 'code'

/**
 * Ordered blocks on a card side (iPhone Notes–style).
 * - `text`: one rich HTML doc (bold/italic/underline/lists) — no embedded code fences
 * - `code`: CodeMirror snippet with language
 * - `image` / `audio`: media
 */
export type SideBlock =
  | { type: 'text'; html: string }
  | { type: 'code'; lang: CodeLang; code: string }
  | { type: 'image'; content: ImageContent }
  | { type: 'audio'; content: MediaDBRecord }

export type CardSideData = {
  side: SideName
  blocks: SideBlock[]
}

export type CardData = {
  front: CardSideData
  back: CardSideData
}

/** Exclusive text|image|code side stored before the blocks migration. */
export type LegacyCardSideData = {
  side: SideName
  type: SideContentType
  content: SideContent
}

export type LegacyCardData = {
  front: LegacyCardSideData
  back: LegacyCardSideData
}

export type CardHandle = {
  getContent: () => CardData
  resetContent: () => void
  focusContent: (side: SideName, which?: 'first' | 'last') => void
}
