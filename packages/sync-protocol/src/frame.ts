import { FRAME_MAGIC } from './types.js'
import { decodeEnvelope, encodeEnvelope } from './codec.js'
import type { SyncEnvelope } from './types.js'

/**
 * Frame format: [1 byte magic 0x53][4 byte BE length][protobuf SyncEnvelope]
 */
export function encodeFrame(envelope: SyncEnvelope): Uint8Array {
  const body = encodeEnvelope(envelope)
  const frame = new Uint8Array(5 + body.length)
  frame[0] = FRAME_MAGIC
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength)
  view.setUint32(1, body.length, false)
  frame.set(body, 5)
  return frame
}

export function decodeFrame(frame: Uint8Array): SyncEnvelope {
  if (frame.length < 5) {
    throw new Error('Frame too short')
  }
  if (frame[0] !== FRAME_MAGIC) {
    throw new Error('Invalid frame magic')
  }
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength)
  const length = view.getUint32(1, false)
  if (frame.length < 5 + length) {
    throw new Error('Frame truncated')
  }
  return decodeEnvelope(frame.subarray(5, 5 + length))
}

export function createEnvelopeId(): string {
  return crypto.randomUUID()
}
