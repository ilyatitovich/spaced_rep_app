import { getCycleDay, LEITNER_64_DAY_SCHEDULE } from '@/lib'

export class Day {
  date: number
  todayLevels: number[]
  isDone: boolean

  constructor(date: number) {
    this.date = date
    this.todayLevels = [1]
    this.isDone = false
  }

  public setLevelList(pivot: number): void {
    this.todayLevels = LEITNER_64_DAY_SCHEDULE[getCycleDay(pivot, this.date)]
  }
}
