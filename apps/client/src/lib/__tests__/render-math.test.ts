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
})
