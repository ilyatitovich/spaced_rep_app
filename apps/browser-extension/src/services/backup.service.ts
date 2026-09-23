import { getCards } from './cards.service'
import { getTopics } from './topics.service'

export async function createBackup(): Promise<{
  blob: Blob
  cardIds: string[]
}> {
  const cards = await getCards()
  return {
    blob: new Blob(
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
    ),
    cardIds: cards.map(card => card.id)
  }
}
