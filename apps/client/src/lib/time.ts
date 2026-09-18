export function formatSyncTime(timestamp: number | null): string {
  if (!timestamp) return 'Never'

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** Relative last-seen for sync devices (not clock-only like formatSyncTime). */
export function formatLastSeen(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'Unknown'

  const minutes = Math.floor((Date.now() - then) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  })
}
