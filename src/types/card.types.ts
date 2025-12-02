import type { CodeLang } from '@/lib'

export type SideName = 'front' | 'back'

export type ImageDBRecord = { buffer: ArrayBuffer; type: string }

export type SideContent = string | Blob | CodeBlock | ImageDBRecord

export type CodeBlock = {
  lang: CodeLang
  code: string
}

export type CardHandle = {
  getContent: () => CardData
  resetContent: () => void
  focusContent: (side: SideName) => void
}

export type SideContentType = 'text' | 'image' | 'code'

export type CardSideData = {
  side: SideName
  type: SideContentType
  content: SideContent
}

export type CardData = {
  front: CardSideData
  back: CardSideData
}
