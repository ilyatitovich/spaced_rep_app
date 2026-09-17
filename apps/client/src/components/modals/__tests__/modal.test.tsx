import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import Modal from '../modal'

describe('Modal header', () => {
  it('shows CloseButton on center and skips it on sheet', () => {
    const { rerender } = render(
      <Modal isOpen onClose={() => {}} variant="center" title="Export">
        Body
      </Modal>
    )

    expect(screen.getByRole('heading', { name: 'Export' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2)

    rerender(
      <Modal isOpen onClose={() => {}} variant="sheet" title="Move to level">
        Body
      </Modal>
    )

    expect(
      screen.getByRole('heading', { name: 'Move to level' })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1)
  })
})
