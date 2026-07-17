export function formatSyncTime(timestamp: number | null): string {
  if (!timestamp) return 'Never'

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}
