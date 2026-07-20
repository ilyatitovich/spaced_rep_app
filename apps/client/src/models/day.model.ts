import { LEITNER_64_DAY_SCHEDULE } from '@/lib'

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
    const day = Math.floor((this.date - pivot) / 86400000)
    this.todayLevels = LEITNER_64_DAY_SCHEDULE[day % 64]
  }
}
