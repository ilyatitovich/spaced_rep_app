import {
  decodeCardData,
  encodeCardData
} from '@/lib/sync-serialize'
import type { CardData, LegacyCardData } from '@/types'

function bytes(values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length)
  new Uint8Array(buffer).set(values)
  return buffer
}

function bufferEquals(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false
  const left = new Uint8Array(a)
  const right = new Uint8Array(b)
  return left.every((value, i) => value === right[i])
}

describe('encodeCardData / decodeCardData', () => {
  it('roundtrips multi-block image+audio', () => {
    const image = bytes([1, 2, 3])
    const audio = bytes([4, 5, 6, 7])

    const data: CardData = {
      front: {
        side: 'front',
        blocks: [
          { type: 'text', html: '<p>Q</p>' },
          {
            type: 'image',
            content: { buffer: image, type: 'image/png' }
          }
        ]
      },
      back: {
        side: 'back',
        blocks: [
          {
            type: 'audio',
            content: { buffer: audio, type: 'audio/mpeg' }
          }
        ]
      }
    }

    const encoded = encodeCardData(data) as CardData
    const imageBlock = encoded.front.blocks[1]
    const audioBlock = encoded.back.blocks[0]

    expect(imageBlock.type).toBe('image')
    expect(audioBlock.type).toBe('audio')
    if (imageBlock.type === 'image' && audioBlock.type === 'audio') {
      expect(typeof imageBlock.content.buffer).toBe('string')
      expect(typeof audioBlock.content.buffer).toBe('string')
    }

    const decoded = decodeCardData(encoded) as CardData
    const decodedImage = decoded.front.blocks[1]
    const decodedAudio = decoded.back.blocks[0]

    expect(decoded.front.blocks[0]).toEqual({ type: 'text', html: '<p>Q</p>' })
    expect(decodedImage.type).toBe('image')
    expect(decodedAudio.type).toBe('audio')
    if (decodedImage.type === 'image' && decodedAudio.type === 'audio') {
      expect(decodedImage.content.type).toBe('image/png')
      expect(decodedAudio.content.type).toBe('audio/mpeg')
      expect(bufferEquals(decodedImage.content.buffer, image)).toBe(true)
      expect(bufferEquals(decodedAudio.content.buffer, audio)).toBe(true)
    }
  })

  it('still encodes legacy exclusive image sides', () => {
    const image = bytes([9, 8])
    const data: LegacyCardData = {
      front: {
        side: 'front',
        type: 'image',
        content: { buffer: image, type: 'image/webp' }
      },
      back: { side: 'back', type: 'text', content: 'answer' }
    }

    const encoded = encodeCardData(data) as LegacyCardData
    expect(typeof (encoded.front.content as { buffer: unknown }).buffer).toBe(
      'string'
    )

    const decoded = decodeCardData(encoded) as LegacyCardData
    expect(decoded.front.type).toBe('image')
    expect(
      bufferEquals(
        (decoded.front.content as { buffer: ArrayBuffer }).buffer,
        image
      )
    ).toBe(true)
    expect(decoded.back).toEqual(data.back)
  })
})
