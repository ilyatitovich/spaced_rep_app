export type SideName = 'front' | 'back'

export type CardHandle = {
  getContent: () => CardData
  resetContent: () => void
}

export type SideContentType = 'text' | 'image' | 'code'

export type CardSideData = {
  side: SideName
  type: SideContentType
  content: string | Blob
}

export type CardData = {
  front: CardSideData
  back: CardSideData
}
