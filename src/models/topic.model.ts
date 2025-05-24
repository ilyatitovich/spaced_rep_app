import { nanoid } from 'nanoid'

import { levelColors } from '../lib/utils'
import { getNextUpdateDate } from '../lib/utils'
import { Card } from './card.model'
import type { levelColor } from '@/lib/definitions'
import { Day, Level } from '@/lib/helpers'

export class Topic {
  id: string
  title: string
  pivot: number
  week: Array<Day | null>
  draft: Card[]
  levels: Level[]
  nextUpdateDate: number

  constructor(title: string) {
    this.id = nanoid()
    this.title = title
    this.pivot = Date.now()
    this.week = this.setStartWeek(this.pivot)
    this.draft = []
    this.levels = this.createLevelsList(levelColors)
    this.nextUpdateDate = getNextUpdateDate()
  }

  setStartWeek(timestamp: number) {
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

  createLevelsList(colors: levelColor[]) {
    return colors.map((color, index) => new Level(index + 1, color))
  }
}
