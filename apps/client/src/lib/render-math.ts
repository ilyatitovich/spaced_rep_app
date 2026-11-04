import renderMathInElement from 'katex/contrib/auto-render'

/** Delimiters KaTeX auto-render understands (Anki MathJax + $ / $$). */
export const CARD_MATH_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
  { left: '\\[', right: '\\]', display: true }
]

/** Typeset LaTeX delimiters already present in `el`'s text nodes. */
export function renderCardMath(el: HTMLElement): void {
  renderMathInElement(el, {
    delimiters: CARD_MATH_DELIMITERS,
    throwOnError: false,
    ignoredTags: [
      'script',
      'noscript',
      'style',
      'textarea',
      'pre',
      'code',
      'option'
    ]
  })
}
