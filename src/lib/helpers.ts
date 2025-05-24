import { Card } from '@/models'

/*

Card's levels:

0 - draft
1 - everyday
2 - every 2 days
3 - every 4 days
4 - every 8 days
5 - every 16 days
6 - every 32 days
7 - every 64 days
8 - finished

*/

export class Level {
  id: number
  cards: Card[]

  constructor(id: number) {
    this.id = id
    this.cards = []
  }
}

export class Day {
  date: number
  todayLevels: number[]
  isDone: boolean

  constructor(date: number) {
    this.date = date
    this.todayLevels = [1]
    this.isDone = false
  }

  setLevelList(pivot: number) {
    const numOfDays = Math.floor((this.date - pivot) / 86400000 + 1)

    const levelConditions = [
      { divisor: 2, level: 2 },
      { divisor: 5, level: 3 },
      { divisor: 9, level: 4 },
      { divisor: 17, level: 5 },
      { divisor: 33, level: 6 },
      { divisor: 65, level: 7 }
    ]

    levelConditions.forEach(condition => {
      if (numOfDays % condition.divisor === 0) {
        this.todayLevels.push(condition.level)
      }
    })
  }
}
