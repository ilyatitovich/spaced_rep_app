import { afterEach, describe, expect, it } from 'vitest'

import { useScreenStackStore } from '../screen-stack-store'

afterEach(() => {
  useScreenStackStore.setState({ stack: [] })
})

describe('screen stack store', () => {
  it('treats every id except the last as behind', () => {
    const { push, pop } = useScreenStackStore.getState()

    push('home')
    push('topic')
    expect(useScreenStackStore.getState().stack).toEqual(['home', 'topic'])

    pop('topic')
    expect(useScreenStackStore.getState().stack).toEqual(['home'])

    pop('home')
    expect(useScreenStackStore.getState().stack).toEqual([])
  })
})
