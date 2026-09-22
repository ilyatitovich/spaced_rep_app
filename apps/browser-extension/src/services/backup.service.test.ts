import { emptyCardData } from '../lib/card-codec'
import { createBackup } from './backup.service'
import { saveCard } from './cards.service'
import { createTopic } from './topics.service'

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

it('exports locally saved cards in the app backup format', async () => {
  const topic = await createTopic('Web clips')
  const data = emptyCardData()
  data.front.blocks = [{ type: 'text', html: '<b>Question</b>' }]
  data.back.blocks = [
    {
      type: 'image',
      content: {
        buffer: Uint8Array.from([1, 2, 3]).buffer,
        type: 'image/png'
      }
    }
  ]
  await saveCard(data, topic.id)

  const blob = await createBackup()
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
  const backup = JSON.parse(text) as {
    version: number
    topics: unknown[]
    cards: Array<{ data: { back: { blocks: Array<{ content: unknown }> } } }>
  }
  expect(backup.version).toBe(1)
  expect(backup.topics).toHaveLength(1)
  expect(backup.cards[0]?.data.back.blocks[0]?.content).toEqual({
    buffer: 'AQID',
    type: 'image/png'
  })
})
