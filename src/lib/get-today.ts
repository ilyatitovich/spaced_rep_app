export function getToday(): number {
  return new Date().getDay()
}

export function isAnotherDay(date: Date | string | number): boolean {
  const d = new Date(date)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const input = new Date(d)
  input.setHours(0, 0, 0, 0)

  return input.getTime() < today.getTime()
}
