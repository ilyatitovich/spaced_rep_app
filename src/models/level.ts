import type { LevelColor } from '@/types'

import { CardModel } from './card'

export class Level {
  id: number
  color: LevelColor
  cards: CardModel[] = []

  constructor(id: number, color: LevelColor) {
    this.id = id
    this.color = color
  }
}
