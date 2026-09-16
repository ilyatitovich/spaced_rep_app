import { describe, expect, it } from 'vitest'

import { renderMathInHtml } from '@/lib/render-math'

describe('renderMathInHtml', () => {
  it('renders Anki inline [$]...[/$] to katex', () => {
    const out = renderMathInHtml('<p>Let [$]E=mc^2[/$] hold</p>')
    expect(out).toContain('katex')
    expect(out).not.toContain('[$]')
  })

  it('renders MathJax \\(...\\) as inline and \\[...\\] / [$$] as display', () => {
    const inline = renderMathInHtml('<p>\\(x^2\\)</p>')
    expect(inline).toContain('katex')
    expect(inline).not.toContain('katex-display')

    const displayBracket = renderMathInHtml('<p>\\[a+b\\]</p>')
    expect(displayBracket).toContain('katex-display')

    const displayAnki = renderMathInHtml('<p>[$$]\\frac{a}{b}[/$$]</p>')
    expect(displayAnki).toContain('katex-display')
  })

  it('renders [latex]...[/latex] as display', () => {
    const out = renderMathInHtml('<p>[latex]\\frac{a}{b}[/latex]</p>')
    expect(out).toContain('katex')
  })

  it('leaves bare $ alone (currency)', () => {
    const html = '<p>no math $100</p>'
    expect(renderMathInHtml(html)).toBe(html)
  })

  it('does not throw on invalid TeX; source stays visible', () => {
    expect(() =>
      renderMathInHtml('<p>[$]\\invalid{[/ $]</p>')
    ).not.toThrow()

    const out = renderMathInHtml('<p>[$]\\frac{[/$]</p>')
    expect(out).toMatch(/\\frac|katex-error/)
  })

  it('renders the common formula smoke set', () => {
    const samples = [
      '<p>\\(x^2 + y^2 = z^2\\)</p>',
      '<p>\\[\\frac{a}{b} = \\frac{c}{d}\\]</p>',
      '<p>\\[\\sqrt{x^2 + y^2}\\]</p>',
      '<p>\\[\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\\]</p>',
      '<p>\\[\\int_0^1 x^2\\,dx = \\frac{1}{3}\\]</p>',
      '<p>\\[\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1\\]</p>',
      '<p>\\[\\mathbf{F} = m\\mathbf{a}\\]</p>',
      '<p>\\[E = mc^2\\]</p>',
      `<p>\\[A =
\\begin{pmatrix}
1 & 2 \\\\
3 & 4
\\end{pmatrix}
\\]</p>`
    ]

    for (const html of samples) {
      const out = renderMathInHtml(html)
      expect(out).toContain('katex')
      expect(out).not.toContain('katex-error')
      expect(out).not.toContain('\\(')
      expect(out).not.toContain('\\[')
    }

    expect(renderMathInHtml(samples[0]!)).not.toContain('katex-display')
    expect(renderMathInHtml(samples[1]!)).toContain('katex-display')
  })
})
