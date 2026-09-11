const UNITS = ['B', 'KB', 'MB', 'GB'] as const

/** Format a byte count for display (e.g. 1536 → "1.5 KB"). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024
    unitIndex++
  }

  if (unitIndex === 0) return `${Math.round(value)} B`
  return `${value.toFixed(1)} ${UNITS[unitIndex]}`
}
