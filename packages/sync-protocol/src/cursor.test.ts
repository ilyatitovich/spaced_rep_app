import {
  INITIAL_CURSOR,
  cursorFromSeq,
  isCursorAhead,
  parseCursor
} from './cursor.js'

describe('sync cursor', () => {
  it('starts at zero and round-trips a server sequence', () => {
    expect(parseCursor(INITIAL_CURSOR)).toBe(0n)
    expect(parseCursor(cursorFromSeq(42n))).toBe(42n)
    expect(cursorFromSeq(9_007_199_254_740_993n)).toBe('9007199254740993')
  })

  it.each([
    ['empty', ''],
    ['legacy ISO watermark from protocol v3', '2024-06-01T00:00:00.000Z'],
    ['negative', '-5'],
    ['fractional', '1.5'],
    ['padded', ' 7']
  ])('reads a %s cursor as "from the start"', (_name, value) => {
    expect(parseCursor(value)).toBe(0n)
  })

  it('keeps the largest bigint sequence and reads anything bigger as "from the start"', () => {
    expect(parseCursor('9223372036854775807')).toBe(9_223_372_036_854_775_807n)
    expect(parseCursor('9223372036854775808')).toBe(0n)
    expect(parseCursor('9'.repeat(5000))).toBe(0n)
  })

  it('compares numerically, not as strings', () => {
    expect(isCursorAhead('10', '9')).toBe(true)
    expect(isCursorAhead('9', '10')).toBe(false)
    expect(isCursorAhead('7', '7')).toBe(false)
  })

  it('treats any real cursor as ahead of a legacy ISO one', () => {
    expect(isCursorAhead('1', '2024-06-01T00:00:00.000Z')).toBe(true)
  })
})
