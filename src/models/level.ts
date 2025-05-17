import { CardModel } from './card'
import type { LevelColor } from '@/types'

export class Level {
  id: number
  color: LevelColor
  cards: CardModel[] = []

  constructor(id: number, color: LevelColor) {
    this.id = id
    this.color = color
  }
}
