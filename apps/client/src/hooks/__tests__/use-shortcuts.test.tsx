import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import BackButton from '@/components/ui/back-button'
import { BACK_BUTTON_ATTR } from '@/lib/keyboard'

import { useKeyboardManager } from '../use-shortcuts'

function Harness() {
  useKeyboardManager()
  return (
    <MemoryRouter>
      <BackButton />
    </MemoryRouter>
  )
}

describe('useKeyboardManager', () => {
  it('clicks the back button on Escape', () => {
    const { getByRole } = render(<Harness />)
    const button = getByRole('button', { name: 'Back' })
    button.getBoundingClientRect = () =>
      ({
        width: 40,
        height: 40,
        top: 8,
        left: 8,
        bottom: 48,
        right: 48,
        x: 8,
        y: 8,
        toJSON() {}
      }) as DOMRect

    const onClick = vi.fn()
    button.addEventListener('click', onClick)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(onClick).toHaveBeenCalledOnce()
    expect(button).toHaveAttribute(BACK_BUTTON_ATTR)
  })
})
