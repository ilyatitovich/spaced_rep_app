export type CardSide = 'front' | 'back'

export type CardHandle = {
  getContent: () => CardData
}

export type CardData = {
  front: string | File
  back: string | File
}
