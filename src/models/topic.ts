import { nanoid } from 'nanoid'

import { saveTopic } from '@/lib/db'
import { levelColors } from '@/lib/utils'
import { DayOfWeek, Level, CardModel } from '@/models'
import type { LevelColor } from '@/types'

export class Topic {
  id: string
  title: string
  pivotDate: number
  week: Array<DayOfWeek | null> = []
  draft: CardModel[] = []
  levels: Level[]
  nextUpdateDate: number

  constructor(title: string) {
    this.id = nanoid()
    this.title = title
    this.pivotDate = Date.now()
    this.levels = this.createLevelsList(levelColors)

    this.setWeek(this.pivotDate)
    this.nextUpdateDate = this.getNextSundayTimestamp()
  }

  private setWeek(timestamp: number): void {
    const startDay = new Date(timestamp).getDay()
    this.week = Array.from({ length: 7 }, (_, d) =>
      d < startDay ? null : this.createDay(timestamp, d - startDay)
    )
  }

  private createDay(baseTimestamp: number, offset: number): DayOfWeek {
    const day = new DayOfWeek(baseTimestamp + offset * 86400000)
    day.calculateReviewLevels(this.pivotDate)
    return day
  }

  private getNextSundayTimestamp(): number {
    const today = new Date()

    // Ensures Sunday is always in the future
    const daysUntilSunday = (7 - today.getDay()) % 7 || 7

    const nextSunday = new Date(today)
    nextSunday.setDate(today.getDate() + daysUntilSunday)
    nextSunday.setHours(0, 0, 0, 0)

    return nextSunday.getTime()
  }

  // Call this on Sunday to refresh the week
  updateWeek(): void {
    this.setWeek(Date.now())
    this.nextUpdateDate = this.getNextSundayTimestamp()
    saveTopic(this)
  }

  private createLevelsList(colors: LevelColor[]): Level[] {
    return colors.map((color, index) => new Level(index + 1, color))
  }
}
