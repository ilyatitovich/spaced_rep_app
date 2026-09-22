import { describe, expect, it } from 'vitest'

import {
  appendSideBlocks,
  didAppendSideBlock,
  insertSideBlock,
  isCardDataEqual,
  isSideEmpty,
  isTextHtmlEmpty,
  replaceTextSelectionWithCode
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

describe('insertSideBlock', () => {
  const image = {
    type: 'image' as const,
    content: { buffer: new ArrayBuffer(1), type: 'image/webp' }
  }

  it('replaces empty focused text', () => {
    expect(
      insertSideBlock([{ type: 'text', html: '<p></p>' }], 0, image)
    ).toEqual([image])
  })

  it('inserts after written text without dropping it', () => {
    expect(
      insertSideBlock([{ type: 'text', html: '<p>Q</p>' }], 0, image)
    ).toEqual([{ type: 'text', html: '<p>Q</p>' }, image])
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
    expect(
      appendSideBlocks([{ type: 'text', html: '<p></p>' }], [image])
    ).toEqual([image])
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

describe('replaceTextSelectionWithCode', () => {
  it('splits a middle selection into before | code | after with detected lang', () => {
    expect(
      replaceTextSelectionWithCode(
        [{ type: 'text', html: '<p>hello print(1) world</p>' }],
        0,
        {
          beforeHtml: '<p>hello </p>',
          code: 'print(1)',
          afterHtml: '<p> world</p>'
        }
      )
    ).toEqual([
      { type: 'text', html: '<p>hello </p>' },
      { type: 'code', lang: 'py', code: 'print(1)' },
      { type: 'text', html: '<p> world</p>' }
    ])
  })

  it('replaces the whole text block when before and after are empty', () => {
    expect(
      replaceTextSelectionWithCode(
        [
          { type: 'text', html: '<p>print(1)</p>' },
          { type: 'image', content: { buffer: new ArrayBuffer(0), type: 'image/webp' } }
        ],
        0,
        { beforeHtml: '', code: 'print(1)', afterHtml: '<p></p>' }
      )
    ).toEqual([
      { type: 'code', lang: 'py', code: 'print(1)' },
      { type: 'image', content: { buffer: new ArrayBuffer(0), type: 'image/webp' } }
    ])
  })

  it('drops empty before or after and falls back to lang code for plain text', () => {
    expect(
      replaceTextSelectionWithCode(
        [{ type: 'text', html: '<p>hello world</p>' }],
        0,
        { beforeHtml: '<p></p>', code: 'hello world', afterHtml: '' }
      )
    ).toEqual([{ type: 'code', lang: 'code', code: 'hello world' }])
  })
})

describe('didAppendSideBlock', () => {
  const image = {
    type: 'image' as const,
    content: { buffer: new ArrayBuffer(1), type: 'image/webp' }
  }

  it('is true when media or code is appended after existing content', () => {
    expect(
      didAppendSideBlock(
        [{ type: 'text', html: '<p>long</p>' }],
        [{ type: 'text', html: '<p>long</p>' }, image]
      )
    ).toBe(true)
    expect(
      didAppendSideBlock(
        [{ type: 'text', html: '<p>long</p>' }],
        [
          { type: 'text', html: '<p>long</p>' },
          { type: 'code', lang: 'ts', code: '' }
        ]
      )
    ).toBe(true)
  })

  it('is true when trailing empty text is replaced by media', () => {
    expect(didAppendSideBlock([{ type: 'text', html: '' }], [image])).toBe(true)
  })

  it('is false when only the last text changes', () => {
    expect(
      didAppendSideBlock(
        [{ type: 'text', html: '<p>a</p>' }],
        [{ type: 'text', html: '<p>ab</p>' }]
      )
    ).toBe(false)
  })
})
