import { createBackup } from '@ext/services/backup.service'
import { deleteCards } from '@ext/services/cards.service'

export async function exportCards(): Promise<void> {
  const { blob, cardIds } = await createBackup()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `spaced-rep-browser-cards-${new Date().toISOString()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  await deleteCards(cardIds, false)
}
