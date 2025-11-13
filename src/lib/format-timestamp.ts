export function formatTimestamp(timestamp: string | number): string {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ]

  const date = new Date(Number(timestamp))
  if (isNaN(date.getTime())) return 'Invalid date'

  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()

  if (sameYear) {
    return `${months[date.getMonth()]} ${date.getDate()}`
  }

  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}
