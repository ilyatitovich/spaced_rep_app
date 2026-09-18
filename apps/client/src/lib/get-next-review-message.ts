import { LEITNER_64_DAY_SCHEDULE } from './leitner-schedule'

const DAY_MS = 86_400_000
const CYCLE_LENGTH = LEITNER_64_DAY_SCHEDULE.length

function startOfDayTs(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function addDays(ts: number, days: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

function getNextReviewDate(
  fromTs: number,
  level: number,
  pivot: number,
  includeToday: boolean
): number {
  const from = startOfDayTs(fromTs)
  const currentDay = Math.round((from - startOfDayTs(pivot)) / DAY_MS)
  const cycleDay = ((currentDay % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH
  const minOffset = includeToday ? 0 : 1

  for (let offset = minOffset; offset < minOffset + CYCLE_LENGTH; offset++) {
    const index = (cycleDay + offset) % CYCLE_LENGTH
    if (LEITNER_64_DAY_SCHEDULE[index].includes(level)) {
      return addDays(from, offset)
    }
  }

  throw new Error(`Level ${level} not found in schedule`)
}

function formatReviewDate(ts: number): string {
  const next = startOfDayTs(ts)
  const today = startOfDayTs(Date.now())
  const diffDays = Math.round((next - today) / DAY_MS)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'

  const d = new Date(next)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

export function getReviewMessage(
  startDateTs: number,
  level: number,
  isDone: boolean
): string {
  if (level === 0) return ''

  return formatReviewDate(
    getNextReviewDate(Date.now(), level, startDateTs, !isDone)
  )
}
