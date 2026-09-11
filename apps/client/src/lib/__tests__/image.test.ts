import { describe, expect, it } from 'vitest'

import { rotateSize } from '@/lib/image'

describe('rotateSize', () => {
  it('keeps dimensions at 0°', () => {
    expect(rotateSize(200, 100, 0).width).toBeCloseTo(200)
    expect(rotateSize(200, 100, 0).height).toBeCloseTo(100)
  })

  it('swaps bounding box at 90°', () => {
    expect(rotateSize(200, 100, 90).width).toBeCloseTo(100)
    expect(rotateSize(200, 100, 90).height).toBeCloseTo(200)
  })
})
