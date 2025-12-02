import type { CodeLang } from '@/lib'

export type SideName = 'front' | 'back'

export type SideContent = string | Blob | CodeBlock

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
  content: string | Blob | CodeBlock
}

export type CardData = {
  front: CardSideData
  back: CardSideData
}
