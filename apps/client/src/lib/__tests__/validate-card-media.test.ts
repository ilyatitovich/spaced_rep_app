import { describe, expect, it } from 'vitest'

import {
  mediaFilesFromDataTransfer,
  mediaValidationMessage,
  validateCardMediaFile
} from '@/lib/validate-card-media'

const MB = 1024 * 1024

function file(name: string, type: string, sizeBytes: number): File {
  const body = sizeBytes === 0 ? '' : new Uint8Array(sizeBytes)
  return new File([body], name, { type })
}

describe('validateCardMediaFile', () => {
  it.each([
    ['shot.png', 'image/png'],
    ['shot.jpg', 'image/jpeg'],
    ['shot.gif', 'image/gif'],
    ['shot.webp', 'image/webp']
  ])('accepts %s', (name, type) => {
    expect(validateCardMediaFile(file(name, type, 100))).toEqual({
      ok: true,
      kind: 'image',
      type
    })
  })

  it.each([
    ['clip.mp3', 'audio/mpeg'],
    ['clip.ogg', 'audio/ogg'],
    ['clip.wav', 'audio/wav'],
    ['clip.m4a', 'audio/mp4']
  ])('accepts %s', (name, type) => {
    expect(validateCardMediaFile(file(name, type, 100))).toEqual({
      ok: true,
      kind: 'audio',
      type
    })
  })

  it('rejects empty files', () => {
    expect(validateCardMediaFile(file('empty.png', 'image/png', 0))).toEqual({
      ok: false,
      reason: 'empty'
    })
  })

  it('rejects images over 5MB', () => {
    expect(
      validateCardMediaFile(file('big.png', 'image/png', 5 * MB + 1))
    ).toEqual({ ok: false, reason: 'too_large' })
  })

  it('rejects audio over 10MB', () => {
    expect(
      validateCardMediaFile(file('big.mp3', 'audio/mpeg', 10 * MB + 1))
    ).toEqual({ ok: false, reason: 'too_large' })
  })

  it('rejects SVG by MIME', () => {
    expect(
      validateCardMediaFile(file('evil.svg', 'image/svg+xml', 100))
    ).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('rejects SVG by extension when MIME is empty', () => {
    expect(validateCardMediaFile(file('evil.svg', '', 100))).toEqual({
      ok: false,
      reason: 'unsupported'
    })
  })

  it('rejects pdf and html', () => {
    expect(
      validateCardMediaFile(file('doc.pdf', 'application/pdf', 100))
    ).toEqual({ ok: false, reason: 'unsupported' })
    expect(validateCardMediaFile(file('x.html', 'text/html', 100))).toEqual({
      ok: false,
      reason: 'unsupported'
    })
  })

  it('rejects unknown extension with empty MIME', () => {
    expect(validateCardMediaFile(file('payload.exe', '', 100))).toEqual({
      ok: false,
      reason: 'unsupported'
    })
  })

  it('rejects wrong kind when image expected', () => {
    expect(
      validateCardMediaFile(file('clip.mp3', 'audio/mpeg', 100), 'image')
    ).toEqual({ ok: false, reason: 'wrong_kind' })
  })

  it('rejects wrong kind when audio expected', () => {
    expect(
      validateCardMediaFile(file('shot.png', 'image/png', 100), 'audio')
    ).toEqual({ ok: false, reason: 'wrong_kind' })
  })

  it('infers audio/mpeg from .mp3 when MIME is empty', () => {
    expect(validateCardMediaFile(file('clip.mp3', '', 100))).toEqual({
      ok: true,
      kind: 'audio',
      type: 'audio/mpeg'
    })
  })

  it('infers audio/mp4 from .m4a when MIME is empty', () => {
    expect(validateCardMediaFile(file('clip.m4a', '', 100))).toEqual({
      ok: true,
      kind: 'audio',
      type: 'audio/mp4'
    })
  })
})

describe('mediaValidationMessage', () => {
  it('returns a message per reason', () => {
    expect(mediaValidationMessage({ ok: false, reason: 'empty' })).toMatch(
      /empty/i
    )
    expect(mediaValidationMessage({ ok: false, reason: 'too_large' })).toMatch(
      /large|size/i
    )
    expect(
      mediaValidationMessage({ ok: false, reason: 'unsupported' })
    ).toMatch(/supported|format/i)
    expect(mediaValidationMessage({ ok: false, reason: 'wrong_kind' })).toMatch(
      /image|audio/i
    )
  })
})

describe('mediaFilesFromDataTransfer', () => {
  it('returns File entries from dataTransfer.files', () => {
    const png = file('a.png', 'image/png', 10)
    const mp3 = file('b.mp3', 'audio/mpeg', 10)
    const dt = { files: [png, mp3] } as unknown as DataTransfer
    expect(mediaFilesFromDataTransfer(dt)).toEqual([png, mp3])
  })

  it('skips zero-length entries', () => {
    const empty = file('empty.png', 'image/png', 0)
    const png = file('a.png', 'image/png', 10)
    const dt = { files: [empty, png] } as unknown as DataTransfer
    expect(mediaFilesFromDataTransfer(dt)).toEqual([png])
  })
})
