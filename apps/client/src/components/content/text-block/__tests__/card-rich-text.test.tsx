import { render, waitFor } from '@testing-library/react'
import CardRichText from '@/components/content/text-block/card-rich-text'

describe('CardRichText', () => {
  it('typesets $...$ into a .katex node', async () => {
    const { container } = render(
      <CardRichText html="<p>area $x^2$</p>" className="card-rich-text" />
    )

    await waitFor(() => {
      expect(container.querySelector('.katex')).toBeTruthy()
    })
    expect(container.textContent).toContain('x')
  })

  it('typesets \\(...\\) delimiters into a .katex node', async () => {
    // Build with real backslash characters (avoid JSX/string escape confusion).
    const html = '<p>area ' + String.raw`\(x^2\)` + '</p>'
    const { container } = render(
      <CardRichText html={html} className="card-rich-text" />
    )

    await waitFor(() => {
      expect(container.querySelector('.katex')).toBeTruthy()
    })
  })
})
