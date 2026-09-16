import renderMathInElement from 'katex/contrib/auto-render'

const DELIMITERS = [
  { left: '[$$]', right: '[/$$]', display: true },
  { left: '[$]', right: '[/$]', display: false },
  { left: '[latex]', right: '[/latex]', display: true },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\(', right: '\\)', display: false }
]

export function renderMathInHtml(html: string): string {
  const el = document.createElement('div')
  el.innerHTML = html
  renderMathInElement(el, {
    delimiters: DELIMITERS,
    throwOnError: false
  })
  return el.innerHTML
}
