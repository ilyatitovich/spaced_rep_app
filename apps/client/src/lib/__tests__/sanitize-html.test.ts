import { describe, expect, it } from 'vitest'

import {
  appendSideBlocks,
  isCardDataEqual,
  isSideEmpty,
  isTextHtmlEmpty
} from '@/lib/check-content'
import { sanitizeCardHtml } from '@/lib/sanitize-html'
import type { CardData } from '@/types'

describe('sanitizeCardHtml', () => {
  it('keeps notes formatting and lists', () => {
    const html = '<p><b>bold</b> <i>i</i> <u>u</u></p><ul><li>a</li></ul>'
    expect(sanitizeCardHtml(html)).toContain('<b>')
    expect(sanitizeCardHtml(html)).toContain('<i>')
    expect(sanitizeCardHtml(html)).toContain('<u>')
    expect(sanitizeCardHtml(html)).toContain('<ul>')
    expect(sanitizeCardHtml(html)).toContain('<li>')
  })

  it('strips scripts and embedded code fences from text', () => {
    const clean = sanitizeCardHtml(
      '<script>x</script><pre><code>y</code></pre>hi'
    )
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('<pre>')
    expect(clean).toContain('hi')
  })
})

describe('isSideEmpty / isCardDataEqual', () => {
  it('treats empty text html as empty', () => {
    expect(isTextHtmlEmpty('<p><br></p>')).toBe(true)
    expect(isTextHtmlEmpty('<p>hi</p>')).toBe(false)
    expect(
      isSideEmpty({ side: 'front', blocks: [{ type: 'text', html: '' }] })
    ).toBe(true)
  })

  it('compares block card data including code', () => {
    const a: CardData = {
      front: {
        side: 'front',
        blocks: [{ type: 'code', lang: 'ts', code: '1' }]
      },
      back: { side: 'back', blocks: [{ type: 'text', html: '<p>A</p>' }] }
    }
    const b: CardData = {
      front: {
        side: 'front',
        blocks: [{ type: 'code', lang: 'ts', code: '1' }]
      },
      back: { side: 'back', blocks: [{ type: 'text', html: '<p>A</p>' }] }
    }
    const c: CardData = {
      front: {
        side: 'front',
        blocks: [{ type: 'code', lang: 'ts', code: '2' }]
      },
      back: { side: 'back', blocks: [{ type: 'text', html: '<p>A</p>' }] }
    }
    expect(isCardDataEqual(a, b)).toBe(true)
    expect(isCardDataEqual(a, c)).toBe(false)
  })
})

describe('appendSideBlocks', () => {
  it('replaces a trailing empty text when adding code or media', () => {
    expect(
      appendSideBlocks(
        [{ type: 'text', html: '' }],
        [{ type: 'code', lang: 'ts', code: '' }]
      )
    ).toEqual([{ type: 'code', lang: 'ts', code: '' }])

    const image = {
      type: 'image' as const,
      content: { buffer: new ArrayBuffer(1), type: 'image/webp' }
    }
    expect(appendSideBlocks([{ type: 'text', html: '<p></p>' }], [image])).toEqual(
      [image]
    )
  })

  it('keeps written text and does not insert a trailing empty text', () => {
    expect(
      appendSideBlocks(
        [{ type: 'text', html: '<p>Q</p>' }],
        [{ type: 'code', lang: 'js', code: '' }]
      )
    ).toEqual([
      { type: 'text', html: '<p>Q</p>' },
      { type: 'code', lang: 'js', code: '' }
    ])
  })
})
