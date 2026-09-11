import { describe, expect, it } from 'vitest'

import { sumEmbeddedCardMedia } from '../storage-usage'

describe('sumEmbeddedCardMedia', () => {
  it('sums image and audio ArrayBuffers and skips remote src-only images', () => {
    const result = sumEmbeddedCardMedia({
      data: {
        front: {
          side: 'front',
          blocks: [
            { type: 'text', html: '<p>hi</p>' },
            {
              type: 'image',
              content: { buffer: new ArrayBuffer(100), type: 'image/png' }
            },
            { type: 'image', content: { src: 'https://cdn.example/a.png' } }
          ]
        },
        back: {
          side: 'back',
          blocks: [
            {
              type: 'audio',
              content: { buffer: new ArrayBuffer(50), type: 'audio/mpeg' }
            }
          ]
        }
      }
    })

    expect(result).toEqual({ bytes: 150, images: 1, audio: 1 })
  })

  it('returns zeros for empty or missing blocks', () => {
    expect(sumEmbeddedCardMedia({})).toEqual({
      bytes: 0,
      images: 0,
      audio: 0
    })
  })
})
