import { removeLastSearchParam } from '../../lib/remove-last-search-param'

describe('removeLastSearchParam', () => {
  it('returns new URLSearchParams instance (does not mutate input)', () => {
    const prev = new URLSearchParams('a=1&b=2')

    const result = removeLastSearchParam(prev)

    expect(result).not.toBe(prev)
    expect(prev.toString()).toBe('a=1&b=2')
  })

  it('returns empty params if input is empty', () => {
    const prev = new URLSearchParams()

    const result = removeLastSearchParam(prev)

    expect(result.toString()).toBe('')
  })

  it('removes the only param if there is one', () => {
    const prev = new URLSearchParams('a=1')

    const result = removeLastSearchParam(prev)

    expect(result.toString()).toBe('')
  })

  it('removes the last added param', () => {
    const prev = new URLSearchParams('a=1&b=2&c=3')

    const result = removeLastSearchParam(prev)

    expect(result.toString()).toBe('a=1&b=2')
  })

  it('preserves order of remaining params', () => {
    const prev = new URLSearchParams()

    prev.append('x', '1')
    prev.append('y', '2')
    prev.append('z', '3')

    const result = removeLastSearchParam(prev)

    expect(Array.from(result.entries())).toEqual([
      ['x', '1'],
      ['y', '2']
    ])
  })
})
