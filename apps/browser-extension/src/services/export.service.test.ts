import { emptyCardData } from '@ext/lib/card-codec'
import { getCard, saveCard } from './cards.service'
import { exportCards } from './export.service'
import { getOutbox } from './outbox.service'

const values: Record<string, unknown> = {}

beforeEach(() => {
  for (const key of Object.keys(values)) delete values[key]
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: values[key] }),
        set: async (next: Record<string, unknown>) =>
          Object.assign(values, next),
        remove: async (key: string | string[]) => {
          for (const k of Array.isArray(key) ? key : [key]) delete values[k]
        }
      }
    }
  } as unknown as typeof chrome
})

it('removes exported cards from storage without syncing a delete', async () => {
  const card = await saveCard(emptyCardData(), 'topic-1', true)

  await exportCards()

  expect(await getCard(card.id)).toBeUndefined()
  expect(await getOutbox()).toEqual([
    expect.objectContaining({ recordId: card.id, operation: 'upsert' })
  ])
})
