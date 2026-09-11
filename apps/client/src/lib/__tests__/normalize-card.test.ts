import { normalizeCardData, normalizeSide } from '@/lib/normalize-card'

describe('normalizeSide', () => {
  it('maps legacy text to an escaped html text block', () => {
    expect(
      normalizeSide({
        side: 'front',
        type: 'text',
        content: 'a <b> & "c"'
      })
    ).toEqual({
      side: 'front',
      blocks: [{ type: 'text', html: 'a &lt;b&gt; &amp; &quot;c&quot;' }]
    })
  })

  it('maps legacy image to an image block', () => {
    const buffer = new ArrayBuffer(4)
    expect(
      normalizeSide({
        side: 'back',
        type: 'image',
        content: { buffer, type: 'image/png' }
      })
    ).toEqual({
      side: 'back',
      blocks: [{ type: 'image', content: { buffer, type: 'image/png' } }]
    })
  })

  it('maps legacy code to a code block', () => {
    expect(
      normalizeSide({
        side: 'front',
        type: 'code',
        content: { lang: 'ts', code: 'const x = 1 < 2' }
      })
    ).toEqual({
      side: 'front',
      blocks: [{ type: 'code', lang: 'ts', code: 'const x = 1 < 2' }]
    })
  })

  it('extracts embedded pre/code fences into sibling code blocks', () => {
    expect(
      normalizeSide({
        side: 'front',
        blocks: [
          {
            type: 'text',
            html: '<p>before</p><pre><code class="language-py">print(1)</code></pre><p>after</p>'
          }
        ]
      })
    ).toEqual({
      side: 'front',
      blocks: [
        { type: 'text', html: '<p>before</p>' },
        { type: 'code', lang: 'py', code: 'print(1)' },
        { type: 'text', html: '<p>after</p>' }
      ]
    })
  })

  it('passes through an already-normalized blocks side', () => {
    const side = {
      side: 'front' as const,
      blocks: [
        { type: 'text' as const, html: '<p>hi</p>' },
        {
          type: 'audio' as const,
          content: { buffer: new ArrayBuffer(2), type: 'audio/mpeg' }
        }
      ]
    }
    expect(normalizeSide(side)).toEqual(side)
  })

  it('lifts a stored media caption into a following text block', () => {
    const buffer = new ArrayBuffer(2)
    expect(
      normalizeSide({
        side: 'front',
        blocks: [
          {
            type: 'audio',
            content: { buffer, type: 'audio/mpeg' },
            caption: 'clip'
          }
        ]
      })
    ).toEqual({
      side: 'front',
      blocks: [
        { type: 'audio', content: { buffer, type: 'audio/mpeg' } },
        { type: 'text', html: '<p>clip</p>' }
      ]
    })
  })

  it('returns an empty side for unknown input', () => {
    expect(normalizeSide(null, 'back')).toEqual({ side: 'back', blocks: [] })
  })
})

describe('normalizeCardData', () => {
  it('normalizes both sides from legacy card data', () => {
    expect(
      normalizeCardData({
        front: { side: 'front', type: 'text', content: 'Q' },
        back: {
          side: 'back',
          type: 'code',
          content: { lang: 'js', code: '1' }
        }
      })
    ).toEqual({
      front: { side: 'front', blocks: [{ type: 'text', html: 'Q' }] },
      back: {
        side: 'back',
        blocks: [{ type: 'code', lang: 'js', code: '1' }]
      }
    })
  })
})
