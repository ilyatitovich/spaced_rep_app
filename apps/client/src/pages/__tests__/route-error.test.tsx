import type { ReactNode } from 'react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import NotFoundPage from '../not-found'
import RouteErrorPage from '../route-error'

function Boom() {
  throw new Error('route crash')
}

function renderRouter(initialPath: string, indexElement: ReactNode) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Outlet />,
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: indexElement },
          { path: '*', element: <NotFoundPage /> }
        ]
      }
    ],
    { initialEntries: [initialPath] }
  )

  return render(<RouterProvider router={router} />)
}

describe('route errors vs 404', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows Page Not Found for unmatched splat paths', () => {
    renderRouter('/nope', <div>home</div>)

    expect(
      screen.getByRole('heading', { name: '404 - Page Not Found' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Something went wrong' })
    ).not.toBeInTheDocument()
  })

  it('shows error UI instead of 404 when a route throws', () => {
    renderRouter('/', <Boom />)

    expect(
      screen.getByRole('heading', { name: 'Something went wrong' })
    ).toBeInTheDocument()
    expect(screen.queryByText(/404/)).not.toBeInTheDocument()
  })
})
