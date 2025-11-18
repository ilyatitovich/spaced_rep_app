const MS_PER_DAY = 24 * 60 * 60 * 1000

const LEVEL_INTERVAL: Record<number, number> = {
  1: 1,
  2: 2,
  3: 5,
  4: 9,
  5: 17,
  6: 33,
  7: 65
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function getNextReviewDate(startDateTs: number, level: number): Date {
  const days = LEVEL_INTERVAL[level] ?? 1
  if (days <= 0) return startOfDay(new Date(startDateTs))

  // initial next date = startDate + days
  const initialNext = new Date(startDateTs)
  initialNext.setDate(initialNext.getDate() + days)

  const today = startOfDay(new Date())

  // if initialNext already >= today — return start-of-day of that date
  const nextDayStart = startOfDay(initialNext)
  if (nextDayStart.getTime() >= today.getTime()) {
    return nextDayStart
  }

  // compute how many intervals we need to add
  const diffMs = today.getTime() - nextDayStart.getTime()
  // how many full intervals have passed since nextDayStart
  const intervalsPassed = Math.ceil(diffMs / (days * MS_PER_DAY))
  const advanced = new Date(nextDayStart)
  advanced.setDate(advanced.getDate() + intervalsPassed * days)

  // ensure we return start-of-day of advanced date
  return startOfDay(advanced)
}

function formatReviewDate(date: Date): string {
  const today = startOfDay(new Date())
  const next = startOfDay(date)

  const diffDays = Math.round((next.getTime() - today.getTime()) / MS_PER_DAY)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'

  // dd.mm.yyyy
  const dd = String(next.getDate()).padStart(2, '0')
  const mm = String(next.getMonth() + 1).padStart(2, '0')
  const yyyy = next.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export function getReviewMessage(startDateTs: number, level: number): string {
  const next = getNextReviewDate(startDateTs, level)
  return formatReviewDate(next)
}
