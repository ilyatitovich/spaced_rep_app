import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary, ErrorFallback } from '../error-boundary'

let shouldThrow = true

function Boom() {
  if (shouldThrow) throw new Error('boom')
  return <div>recovered</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows error UI instead of 404 when a child throws', () => {
    render(
      <ErrorBoundary fallback={<ErrorFallback />}>
        <Boom />
      </ErrorBoundary>
    )

    expect(
      screen.getByRole('heading', { name: 'Something went wrong' })
    ).toBeInTheDocument()
    expect(screen.queryByText(/404/)).not.toBeInTheDocument()
  })

  it('remounts children after Try again', () => {
    render(
      <ErrorBoundary fallback={<ErrorFallback />}>
        <Boom />
      </ErrorBoundary>
    )

    expect(
      screen.getByRole('heading', { name: 'Something went wrong' })
    ).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('recovered')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Something went wrong' })
    ).not.toBeInTheDocument()
  })
})
