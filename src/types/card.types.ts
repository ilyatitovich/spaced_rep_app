export type CardSide = 'front' | 'back'

export type CardHandle = {
  getContent: () => CardData
  resetContent: () => void
}

export type CardData = {
  front: string | File
  back: string | File
}
