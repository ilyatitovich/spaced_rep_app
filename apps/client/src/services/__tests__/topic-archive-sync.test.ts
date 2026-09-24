import { describe, expect, it } from 'vitest'

import { createTopic } from '@/models'
import { recordToTopic, topicToRecord } from '@/services/sync.service'
import type { TopicRecord } from '@spaced-rep/sync-protocol'

describe('topicToRecord / recordToTopic', () => {
  it('round-trips isArchived', () => {
    const topic = createTopic('Archived')
    topic.isArchived = true

    const roundTripped = recordToTopic(topicToRecord(topic))

    expect(roundTripped.isArchived).toBe(true)
  })

  it('decodes a record with isArchived absent as false', () => {
    const base = topicToRecord(createTopic('Legacy'))
    const { isArchived: _omitted, ...withoutFlag } = base
    const record = withoutFlag as TopicRecord

    expect(record).not.toHaveProperty('isArchived')
    expect(recordToTopic(record).isArchived).toBe(false)
  })
})
