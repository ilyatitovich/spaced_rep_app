import { clearEphemeralStorage } from './chrome-store'
import { DRAFT_KEY, PENDING_KEY } from './keys'

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

it('clears draft and pending capture without touching saved cards', async () => {
  values[DRAFT_KEY] = { front: {} }
  values[PENDING_KEY] = { type: 'RAW_CAPTURE' }
  values.cards = [{ id: 'keep' }]
  await clearEphemeralStorage()
  expect(values[DRAFT_KEY]).toBeUndefined()
  expect(values[PENDING_KEY]).toBeUndefined()
  expect(values.cards).toEqual([{ id: 'keep' }])
})
