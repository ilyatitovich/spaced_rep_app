import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import Checkbox from '../checkbox'

describe('Checkbox', () => {
  it('renders the label and reflects checked state', () => {
    render(
      <Checkbox
        checked
        onChange={() => undefined}
        label="Mark topic as archived"
      />
    )

    expect(
      screen.getByRole('checkbox', { name: 'Mark topic as archived' })
    ).toBeChecked()
  })

  it('calls onChange with the next checked value', () => {
    const onChange = vi.fn()

    render(
      <Checkbox
        checked={false}
        onChange={onChange}
        label="Mark topic as archived"
      />
    )

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Mark topic as archived' })
    )

    expect(onChange).toHaveBeenCalledWith(true)
  })
})
