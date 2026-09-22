import { getCards } from './cards.service'
import { getTopics } from './topics.service'

export async function createBackup(): Promise<Blob> {
  const cards = await getCards()
  return new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          topics: await getTopics(),
          cards
        },
        null,
        2
      )
    ],
    { type: 'application/json' }
  )
}
