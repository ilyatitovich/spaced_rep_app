import {
  appendBlocks,
  createBackup,
  emptyCardData,
  ensureLocalTopic,
  isSideEmpty,
  saveCard
} from './storage'

const values: Record<string, unknown> = {}

beforeEach(() => {
  for (const key of Object.keys(values)) delete values[key]
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: values[key] }),
        set: async (next: Record<string, unknown>) =>
          Object.assign(values, next)
      }
    }
  } as unknown as typeof chrome
})

it('replaces a trailing empty text block when capturing content', () => {
  const result = appendBlocks(
    [{ type: 'text', html: '' }],
    [{ type: 'code', lang: 'ts', code: 'const answer = 42' }]
  )
  expect(result).toEqual([
    { type: 'code', lang: 'ts', code: 'const answer = 42' }
  ])
})

it('exports locally saved cards in the app backup format', async () => {
  const topic = await ensureLocalTopic()
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
  expect(isSideEmpty(data.front.blocks)).toBe(false)
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
