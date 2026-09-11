import { describe, expect, it } from 'vitest'

import { formatBytes } from '../format-bytes'

describe('formatBytes', () => {
  it('formats zero and small byte counts', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes with one decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes and gigabytes with one decimal', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
    expect(formatBytes(1.1 * 1024 * 1024 * 1024)).toBe('1.1 GB')
  })
})
