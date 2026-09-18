import { describe, expect, it } from 'vitest'

import { coalesceQueuedOperation } from '../sync.service'

describe('coalesceQueuedOperation', () => {
  it('drops a pending upsert when the same record is deleted before it syncs', () => {
    expect(coalesceQueuedOperation('upsert', 'delete')).toBeNull()
  })

  it('keeps a delete when the record was never queued as an upsert', () => {
    expect(coalesceQueuedOperation(undefined, 'delete')).toBe('delete')
  })

  it('keeps a delete when the pending upsert may still land on the server', () => {
    expect(coalesceQueuedOperation('upsert', 'delete', true)).toBe('delete')
  })
})
