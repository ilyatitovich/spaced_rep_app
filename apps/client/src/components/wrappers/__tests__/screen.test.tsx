import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import Screen from '../screen'

vi.mock('@/hooks/use-should-animate', () => ({
  useShouldAnimate: () => false
}))

vi.mock('@/store/screen-stack-store', () => {
  const state = {
    stack: [] as string[],
    push: vi.fn(),
    pop: vi.fn()
  }
  return {
    useScreenStackStore: (selector: (s: typeof state) => unknown) =>
      selector(state)
  }
})

describe('Screen onOpen', () => {
  it('does not re-fire onOpen when the callback identity changes while open', () => {
    const first = vi.fn()
    const second = vi.fn()

    const { rerender } = render(
      <Screen isOpen onOpen={first}>
        <div>content</div>
      </Screen>
    )

    expect(first).toHaveBeenCalledTimes(1)

    rerender(
      <Screen isOpen onOpen={second}>
        <div>content</div>
      </Screen>
    )

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('fires onOpen when transitioning from closed to open', () => {
    const onOpen = vi.fn()

    const { rerender } = render(
      <Screen isOpen={false} onOpen={onOpen}>
        <div>content</div>
      </Screen>
    )

    expect(onOpen).not.toHaveBeenCalled()

    rerender(
      <Screen isOpen onOpen={onOpen}>
        <div>content</div>
      </Screen>
    )

    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
