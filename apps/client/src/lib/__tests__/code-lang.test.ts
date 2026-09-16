import { detectCodeLang, toCodeLang } from '@/lib/code-lang'

describe('toCodeLang', () => {
  it('maps python aliases to py', () => {
    expect(toCodeLang('python')).toBe('py')
    expect(toCodeLang('language-py')).toBe('py')
    expect(toCodeLang('hljs python')).toBe('py')
  })

  it('returns code for missing or unknown langs', () => {
    expect(toCodeLang(undefined)).toBe('code')
    expect(toCodeLang('rust')).toBe('code')
  })
})

describe('detectCodeLang', () => {
  it('guesses python from a def/return snippet', () => {
    expect(detectCodeLang('def greet(name):\n    return name')).toBe('py')
  })

  it('guesses sql from a SELECT statement', () => {
    expect(detectCodeLang('SELECT id FROM users WHERE id = 1')).toBe('sql')
  })

  it('guesses shell from a bash shebang', () => {
    expect(detectCodeLang('#!/bin/bash\necho "$HOME"')).toBe('sh')
  })

  it('guesses typescript from an interface', () => {
    expect(detectCodeLang('interface User { id: string }')).toBe('ts')
  })

  it('guesses javascript from a plain function', () => {
    expect(detectCodeLang('function add(a, b) { return a + b }')).toBe('js')
  })

  it('returns code for plain text or empty input', () => {
    expect(detectCodeLang('hello world')).toBe('code')
    expect(detectCodeLang('')).toBe('code')
  })
})
