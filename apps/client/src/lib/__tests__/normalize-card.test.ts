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

  it('maps legacy image to an image block without caption', () => {
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

  it('maps legacy code to a pre/code text block', () => {
    expect(
      normalizeSide({
        side: 'front',
        type: 'code',
        content: { lang: 'ts', code: 'const x = 1 < 2' }
      })
    ).toEqual({
      side: 'front',
      blocks: [
        {
          type: 'text',
          html: '<pre><code class="language-ts">const x = 1 &lt; 2</code></pre>'
        }
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
          content: { buffer: new ArrayBuffer(2), type: 'audio/mpeg' },
          caption: 'clip'
        }
      ]
    }
    expect(normalizeSide(side)).toEqual(side)
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
        blocks: [
          {
            type: 'text',
            html: '<pre><code class="language-js">1</code></pre>'
          }
        ]
      }
    })
  })
})
