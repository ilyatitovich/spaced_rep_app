import { getCycleDay, LEITNER_64_DAY_SCHEDULE } from '@/lib/leitner-schedule'

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
    const levels = LEITNER_64_DAY_SCHEDULE[getCycleDay(pivot, this.date)]
    if (!levels) throw new Error('Schedule index out of range')
    this.todayLevels = levels
  }
}
