export function getToday(): number {
  return new Date().getDay()
}

export function startOfDayTs(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Calendar-day arithmetic, so DST shifts never move the result to another day. */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export function isAnotherDay(date: Date | string | number): boolean {
  const d = new Date(date)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const input = new Date(d)
  input.setHours(0, 0, 0, 0)

  return input.getTime() < today.getTime()
}
