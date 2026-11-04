import { normalizeAnkiMath } from '@/lib/anki/normalize-anki-math'

describe('normalizeAnkiMath', () => {
  it('converts [latex]...[/latex] to display math', () => {
    expect(normalizeAnkiMath('see [latex]x^2[/latex]')).toBe('see \\[x^2\\]')
  })

  it('converts [$$]...[/$$] to display math', () => {
    expect(normalizeAnkiMath('[$$]a+b[/$$]')).toBe('\\[a+b\\]')
  })

  it('converts [$]...[/$] to inline math', () => {
    expect(normalizeAnkiMath('[$]x^2[/$]')).toBe('\\(x^2\\)')
  })

  it('converts anki-mathjax tags (inline and block)', () => {
    expect(normalizeAnkiMath('<anki-mathjax>x^2</anki-mathjax>')).toBe(
      '\\(x^2\\)'
    )
    expect(
      normalizeAnkiMath('<anki-mathjax block="true">\\sum n</anki-mathjax>')
    ).toBe('\\[\\sum n\\]')
  })

  it('is case-insensitive for tags and wrappers', () => {
    expect(normalizeAnkiMath('[LaTeX]y[/LaTeX]')).toBe('\\[y\\]')
    expect(normalizeAnkiMath('<Anki-MathJax>z</Anki-MathJax>')).toBe('\\(z\\)')
  })

  it('trims body whitespace', () => {
    expect(normalizeAnkiMath('[$]  a  [/$]')).toBe('\\(a\\)')
  })

  it('leaves canonical delimiters unchanged', () => {
    const src = 'inline \\(a\\) display \\[b\\] dollar $c$ and $$d$$'
    expect(normalizeAnkiMath(src)).toBe(src)
  })

  it('preserves surrounding HTML', () => {
    expect(normalizeAnkiMath('<b>Q</b> [$]E=mc^2[/$] <i>ok</i>')).toBe(
      '<b>Q</b> \\(E=mc^2\\) <i>ok</i>'
    )
  })
})
