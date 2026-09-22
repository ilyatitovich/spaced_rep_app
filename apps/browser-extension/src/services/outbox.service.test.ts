import { OUTBOX_KEY } from '../lib/keys'
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

describe('getOutbox', () => {
  it('maps a legacy cardId queue item onto the generalized shape', async () => {
    values[OUTBOX_KEY] = [
      { id: 'op-1', cardId: 'card-1', attempts: 2, nextAttemptAt: 50 }
    ]

    expect(await getOutbox()).toEqual([
      {
        id: 'op-1',
        table: 'cards',
        recordId: 'card-1',
        operation: 'upsert',
        updatedAt: 0,
        attempts: 2,
        nextAttemptAt: 50
      }
    ])
  })
})
