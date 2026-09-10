import type { CodeLang } from '@/lib'

export type SideName = 'front' | 'back'

export type ImageDBRecord = { buffer: ArrayBuffer; type: string }

export type ImageBase64Record = { buffer: string; type: string }

export type AudioDBRecord = { buffer: ArrayBuffer; type: string }

/** @deprecated Whole-side code mode; prefer HTML `<pre><code>` inside a text block. */
export type CodeBlock = {
  lang: CodeLang
  code: string
}

/** @deprecated Exclusive side content; use SideBlock list. */
export type SideContent = string | Blob | CodeBlock | ImageDBRecord

/** @deprecated Exclusive side modes; use SideBlock.type. */
export type SideContentType = 'text' | 'image' | 'code'

export type SideBlock =
  | { type: 'text'; html: string }
  | { type: 'image'; content: ImageDBRecord; caption?: string }
  | { type: 'audio'; content: AudioDBRecord; caption?: string }

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
  getContent: () => LegacyCardData
  resetContent: () => void
  focusContent: (side: SideName) => void
}
