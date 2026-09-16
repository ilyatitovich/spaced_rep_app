import { render } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router'
import { describe, expect, it } from 'vitest'

import { useKeyboardManager } from '../use-shortcuts'

function Harness() {
  useKeyboardManager()
  const [params] = useSearchParams()
  return <span data-testid="qs">{params.toString()}</span>
}

describe('useKeyboardManager', () => {
  it('closes the current screen on Escape', () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/?topicId=abc&levelId=2']}>
        <Harness />
      </MemoryRouter>
    )

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(getByTestId('qs')).toHaveTextContent('topicId=abc')
  })
})
