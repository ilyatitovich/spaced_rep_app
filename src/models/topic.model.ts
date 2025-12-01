import { Day } from './day.model'

export class Topic {
  id: string
  title: string
  pivot: number
  week: Array<Day | null>
  nextUpdateDate: number

  constructor(title: string) {
    this.id = crypto.randomUUID()
    this.title = title
    this.pivot = Date.now()
    this.week = this.setStartWeek(this.pivot)
    this.nextUpdateDate = this.getNextUpdateDate()
  }

  static fromRaw(raw: Topic): Topic {
    return Object.assign(new Topic(''), raw)
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

  private getNextUpdateDate(): number {
    const today = new Date()
    const currentDay = today.getDay()

    // Calculate the number of days until the next Sunday
    const daysUntilSunday = 7 - currentDay

    // Set the date to the next Sunday
    const nextSunday = new Date(today)
    nextSunday.setDate(today.getDate() + daysUntilSunday)

    // Set the time to midnight (00:00:00)
    nextSunday.setHours(0, 0, 0, 0)

    // Return the timestamp for the next Sunday at midnight
    return nextSunday.getTime()
  }

  public updateWeek(): void {
    const dayOfTheWeek = new Date().getDay()

    this.week = []

    for (let d = 0; d < 7; d++) {
      const day = new Day(Date.now() + 86400000 * (d - dayOfTheWeek))
      day.setLevelList(this.pivot)
      this.week.push(day)
    }

    this.nextUpdateDate = this.getNextUpdateDate()
  }
}
