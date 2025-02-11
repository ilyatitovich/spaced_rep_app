import type { LevelColor, Card } from '@/types'

export class Level {
  id: number
  color: LevelColor
  cards: Card[] = []

  constructor(id: number, color: LevelColor) {
    this.id = id
    this.color = color
  }
}
