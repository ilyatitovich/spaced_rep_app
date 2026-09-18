import {
  collectWireMediaRefs,
  fromWireCardData,
  isWireMediaRef,
  prepareWireCardData,
  sha256Hex,
  toWireCardData
} from './wire-media.js'
import { SHA256_HEX } from './schemas.js'

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

describe('wire media transform', () => {
  it('hashes buffers to stable lowercase hex', async () => {
    const hash = await sha256Hex(bytes([1, 2, 3]))
    expect(hash).toMatch(SHA256_HEX)
    expect(await sha256Hex(bytes([1, 2, 3]))).toBe(hash)
  })

  it('converts owned buffers to wire refs and leaves { src } alone', async () => {
    const image = bytes([1, 2, 3])
    const audio = bytes([4, 5, 6, 7])
    const data = {
      front: {
        side: 'front',
        blocks: [
          { type: 'text', html: '<p>Q</p>' },
          { type: 'image', content: { buffer: image, type: 'image/png' } },
          {
            type: 'image',
            content: { src: 'https://i.imgur.com/iF4Mkb5.png' }
          }
        ]
      },
      back: {
        side: 'back',
        blocks: [
          { type: 'audio', content: { buffer: audio, type: 'audio/mpeg' } }
        ]
      }
    }

    const wire = (await toWireCardData(data)) as typeof data
    const imageRef = wire.front.blocks[1]?.content
    const remote = wire.front.blocks[2]?.content
    const audioRef = wire.back.blocks[0]?.content

    expect(isWireMediaRef(imageRef)).toBe(true)
    expect(isWireMediaRef(audioRef)).toBe(true)
    if (isWireMediaRef(imageRef) && isWireMediaRef(audioRef)) {
      expect(imageRef.hash).toBe(await sha256Hex(image))
      expect(imageRef.byteLength).toBe(3)
      expect(imageRef.type).toBe('image/png')
      expect(audioRef.hash).toBe(await sha256Hex(audio))
      expect(audioRef.byteLength).toBe(4)
    }
    expect(remote).toEqual({ src: 'https://i.imgur.com/iF4Mkb5.png' })
  })

  it('hydrates wire refs back to local buffers', async () => {
    const image = bytes([9, 8, 7])
    const hash = await sha256Hex(image)
    const wire = {
      front: {
        side: 'front',
        blocks: [
          {
            type: 'image',
            content: { hash, type: 'image/webp', byteLength: 3 }
          }
        ]
      },
      back: { side: 'back', blocks: [{ type: 'text', html: '<p>A</p>' }] }
    }

    const local = (await fromWireCardData(
      wire,
      new Map([[hash, image]])
    )) as {
      front: { blocks: Array<{ content: { buffer: ArrayBuffer; type: string } }> }
    }
    const content = local.front.blocks[0]?.content

    expect(content?.type).toBe('image/webp')
    expect(content && bufferEquals(content.buffer, image)).toBe(true)
  })

  it('transforms legacy exclusive image sides', async () => {
    const image = bytes([2, 4])
    const legacy = {
      front: {
        side: 'front',
        type: 'image',
        content: { buffer: image, type: 'image/png' }
      },
      back: { side: 'back', type: 'text', content: 'answer' }
    }

    const wire = (await toWireCardData(legacy)) as typeof legacy
    expect(isWireMediaRef(wire.front.content)).toBe(true)
    expect(wire.back).toEqual(legacy.back)

    const hash = await sha256Hex(image)
    const local = (await fromWireCardData(
      wire,
      new Map([[hash, image]])
    )) as typeof legacy
    const content = local.front.content as {
      buffer: ArrayBuffer
      type: string
    }
    expect(bufferEquals(content.buffer, image)).toBe(true)
  })

  it('collects unique wire refs', async () => {
    const hash = 'a'.repeat(64)
    const data = {
      front: {
        side: 'front',
        blocks: [
          {
            type: 'image',
            content: { hash, type: 'image/png', byteLength: 1 }
          },
          {
            type: 'image',
            content: { hash, type: 'image/png', byteLength: 1 }
          }
        ]
      },
      back: { side: 'back', blocks: [] }
    }

    const refs = await collectWireMediaRefs(data)
    expect(refs).toHaveLength(1)
    expect(refs[0]?.hash).toBe(hash)
  })

  it('prepareWireCardData returns refs and unique buffers', async () => {
    const image = bytes([1, 2, 3])
    const data = {
      front: {
        side: 'front',
        blocks: [
          { type: 'image', content: { buffer: image, type: 'image/png' } },
          { type: 'image', content: { buffer: image, type: 'image/png' } }
        ]
      },
      back: { side: 'back', blocks: [] }
    }

    const { wireData, mediaByHash } = await prepareWireCardData(data)
    expect(mediaByHash.size).toBe(1)
    expect(mediaByHash.get(await sha256Hex(image))?.type).toBe('image/png')
    const wire = wireData as typeof data
    expect(isWireMediaRef(wire.front.blocks[0]?.content)).toBe(true)
  })
})
