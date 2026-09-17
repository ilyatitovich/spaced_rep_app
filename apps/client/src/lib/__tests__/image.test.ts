import { describe, expect, it } from 'vitest'

import { getClipboardImage, rotateSize } from '@/lib/image'

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

describe('getClipboardImage', () => {
  const png = new File([new Uint8Array([1])], 'shot.png', { type: 'image/png' })

  it('reads an image item from a paste DataTransfer', () => {
    const data = {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => png }],
      files: []
    } as unknown as DataTransfer
    expect(getClipboardImage(data)).toBe(png)
  })

  it('ignores non-image clipboard items', () => {
    const data = {
      items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }],
      files: []
    } as unknown as DataTransfer
    expect(getClipboardImage(data)).toBeNull()
  })
})
