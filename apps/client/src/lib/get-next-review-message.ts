import { LEITNER_64_DAY_SCHEDULE } from './leitner-schedule'

const DAY_MS = 86_400_000
const CYCLE_LENGTH = LEITNER_64_DAY_SCHEDULE.length

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function getNextReviewDate(
  fromTs: number,
  level: number,
  pivot: number
): number {
  const currentDay = Math.floor((fromTs - pivot) / DAY_MS)
  const cycleDay = ((currentDay % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH

  for (let offset = 1; offset <= CYCLE_LENGTH; offset++) {
    const index = (cycleDay + offset) % CYCLE_LENGTH

    if (LEITNER_64_DAY_SCHEDULE[index].includes(level)) {
      return fromTs + offset * DAY_MS
    }
  }

  throw new Error(`Level ${level} not found in schedule`)
}

function formatReviewDate(date: number): string {
  const next = startOfDay(new Date(date))

  const today = startOfDay(new Date())
  if (next.getTime() === today.getTime()) return 'today'

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStart = startOfDay(tomorrow)
  if (next.getTime() === tomorrowStart.getTime()) return 'tomorrow'

  // dd.mm.yy
  const dd = String(next.getDate()).padStart(2, '0')
  const mm = String(next.getMonth() + 1).padStart(2, '0')
  const yy = next.getFullYear().toString().slice(-2)
  return `${dd}.${mm}.${yy}`
}

export function getReviewMessage(
  startDateTs: number,
  level: number,
  isDone: boolean
): string {
  if (level === 0) return ''
  if (isDone) {
    if (level === 1) return 'tomorrow'

    return formatReviewDate(getNextReviewDate(Date.now(), level, startDateTs))
  }

  if (level === 1) return 'today'

  return formatReviewDate(getNextReviewDate(startDateTs, level, startDateTs))
}
