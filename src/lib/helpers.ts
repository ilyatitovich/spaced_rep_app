import type { levelColor } from './definitions'
import { Card } from '@/models'

export class Level {
  id: number
  color: levelColor
  cards: Card[]

  constructor(id: number, color: levelColor) {
    this.id = id
    this.color = color
    this.cards = []
  }
}

export class Day {
  date: number
  todayLevels: number[]
  isDone: boolean

  constructor(date: number) {
    this.date = date
    this.todayLevels = [0]
    this.isDone = false
  }

  setLevelList(pivot: number) {
    const numOfDays = Math.floor((this.date - pivot) / 86400000 + 1)

    const levelConditions = [
      { divisor: 2, level: 1 },
      { divisor: 5, level: 2 },
      { divisor: 9, level: 3 },
      { divisor: 17, level: 4 },
      { divisor: 33, level: 5 },
      { divisor: 65, level: 6 }
    ]

    levelConditions.forEach(condition => {
      if (numOfDays % condition.divisor === 0) {
        this.todayLevels.push(condition.level)
      }
    })
  }
}
