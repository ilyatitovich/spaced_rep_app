/** Delimiters KaTeX auto-render understands (Anki MathJax + $ / $$). */
export const CARD_MATH_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
  { left: '\\[', right: '\\]', display: true }
]

/** Typeset LaTeX delimiters already present in `el`'s text nodes. */
export async function renderCardMath(el: HTMLElement): Promise<void> {
  const { default: renderMathInElement } =
    await import('katex/contrib/auto-render')
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
