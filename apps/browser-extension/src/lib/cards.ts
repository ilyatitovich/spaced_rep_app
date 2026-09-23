import { createBackup } from '@ext/services/backup.service'

export async function exportCards(): Promise<void> {
  const url = URL.createObjectURL(await createBackup())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `spaced-rep-browser-cards-${new Date().toISOString()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
