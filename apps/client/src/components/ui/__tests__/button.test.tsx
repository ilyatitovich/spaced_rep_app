import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import Button from '../button'

describe('Button', () => {
  it('renders a ghost header action by default', () => {
    render(<Button>Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button.className).toContain('text-primary')
    expect(button.className).not.toContain('bg-primary')
  })

  it('applies filled variants and sizes used by modal actions', () => {
    render(
      <Button variant="primary" className="flex-1">
        Update
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Update' })
    expect(button.className).toContain('bg-primary')
    expect(button.className).toContain('py-3')
    expect(button.className).toContain('flex-1')
  })

  it('supports submit buttons and the ariaLabel alias', () => {
    render(
      <Button type="submit" variant="foreground" ariaLabel="Send code" disabled>
        Send code
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Send code' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toBeDisabled()
    expect(button.className).toContain('bg-foreground')
  })
})
