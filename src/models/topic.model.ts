import { nanoid } from 'nanoid'

import { getNextUpdateDate } from '../lib/utils'
import { Day, Level } from '@/lib/helpers'

export class Topic {
  id: string
  title: string
  pivot: number
  week: Array<Day | null>
  levels: Level[]
  nextUpdateDate: number

  constructor(title: string) {
    this.id = nanoid()
    this.title = title
    this.pivot = Date.now()
    this.week = this.setStartWeek(this.pivot)
    this.levels = this.createLevelsList()
    this.nextUpdateDate = getNextUpdateDate()
  }

  private setStartWeek(timestamp: number): Array<Day | null> {
    const week: Array<Day | null> = []
    const dayOfTheWeek = new Date(timestamp).getDay()

    for (let d = 0; d < 7; d++) {
      if (dayOfTheWeek > d) {
        week.push(null)
      } else {
        const day = new Day(timestamp + 86400000 * (d - dayOfTheWeek))
        day.setLevelList(timestamp)
        week.push(day)
      }
    }

    return week
  }

  private createLevelsList(): Level[] {
    return new Array(8).fill(null).map((_, index) => new Level(index))
  }
}
