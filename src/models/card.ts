import { nanoid } from 'nanoid'

export type CardModelData = {
  front: File | string
  back: File | string
}

export class CardModel {
  id: string
  level: number
  data: CardModelData

  constructor(data: CardModelData, level: number = 0) {
    this.id = nanoid()
    this.level = level
    this.data = data
  }
}
