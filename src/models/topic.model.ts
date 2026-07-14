import { Day } from './day.model'

export interface Topic {
  id: string
  title: string
  pivot: number
  week: Array<Day | null>
  nextUpdateDate: number
  updatedAt: number
  deletedAt: number | null
}

export function createTopic(title: string): Topic {
  const pivot = Date.now()

  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    pivot: pivot,
    week: setStartWeek(pivot),
    nextUpdateDate: getNextUpdateDate(),
    updatedAt: pivot,
    deletedAt: null
  }
}

export function setStartWeek(timestamp: number): Array<Day | null> {
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

export function getNextUpdateDate(): number {
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

export function updateWeek(topic: Topic): void {
  const dayOfTheWeek = new Date().getDay()

  topic.week = []

  for (let d = 0; d < 7; d++) {
    const day = new Day(Date.now() + 86400000 * (d - dayOfTheWeek))
    day.setLevelList(topic.pivot)
    topic.week.push(day)
  }

  topic.nextUpdateDate = getNextUpdateDate()
  topic.updatedAt = Date.now()
}
