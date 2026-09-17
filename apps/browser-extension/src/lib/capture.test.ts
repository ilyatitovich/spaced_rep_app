import { normalizeCapture } from './capture'

it('sanitizes selected markup without source attribution', async () => {
  const result = await normalizeCapture({
    html: '<p>Hello <strong>world</strong><script>alert(1)</script></p>',
    text: 'Hello world',
    title: 'Reference',
    url: 'https://example.com/article'
  })

  expect(result.blocks).toEqual([
    { type: 'text', html: '<p>Hello <strong>world</strong></p>' }
  ])
  expect(result.source).toEqual({
    title: 'Reference',
    url: 'https://example.com/article'
  })
})

it('detects code selections using the shared client language logic', async () => {
  const result = await normalizeCapture({
    code: 'const answer: number = 42',
    html: '<code class="language-typescript">const answer</code>',
    title: 'Docs',
    url: 'https://example.com'
  })

  expect(result.blocks[0]).toEqual({
    type: 'code',
    lang: 'ts',
    code: 'const answer: number = 42'
  })
})
