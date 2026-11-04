import { renderCardMath } from '@/lib/render-math'

describe('renderCardMath', () => {
  it('typesets \\(...\\) into a .katex node', () => {
    const el = document.createElement('div')
    el.innerHTML = '<p>area \\(x^2\\)</p>'
    expect(el.textContent).toBe('area \\(x^2\\)')

    renderCardMath(el)

    expect(el.querySelector('.katex')).toBeTruthy()
  })
})
