import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/lib/auth-storage'

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  completeGoogleLogin: vi.fn(),
  exchangeGoogleCode: vi.fn(),
  backendConfigured: true
}))

vi.mock('react-router', () => ({ useNavigate: () => h.navigate }))
vi.mock('react-hot-toast', () => ({
  toast: { error: h.toastError, success: h.toastSuccess }
}))
vi.mock('@/components', () => ({ Spinner: () => null }))
vi.mock('@/contexts', () => ({
  useAuth: () => ({ completeGoogleLogin: h.completeGoogleLogin })
}))
vi.mock('@/lib/api', () => ({ exchangeGoogleCode: h.exchangeGoogleCode }))
vi.mock('@/lib/pkce', () => ({
  googleRedirectUri: () => 'http://localhost:5173/oauth/google/callback'
}))
vi.mock('@/providers', () => ({
  isBackendConfigured: () => h.backendConfigured
}))

const session: AuthSession = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: Date.now() + 900_000,
  user: { id: 'user-1', email: 'a@b.com' }
}

const PENDING = { codeVerifier: 'verifier-123', state: 'state-abc' }

function visit(search: string) {
  window.history.replaceState(null, '', `/oauth/google/callback${search}`)
}

function seedPending(overrides: Record<string, unknown> = {}) {
  sessionStorage.setItem(
    'auth.pkce',
    JSON.stringify({ ...PENDING, ...overrides })
  )
}

/**
 * The page keeps its "sign in once" guard in module scope, so every test gets
 * a fresh module graph (React and Testing Library included, to share one
 * React copy).
 */
let cleanupMounted: () => void = () => {}

async function mount(options: { strict?: boolean; copies?: number } = {}) {
  vi.resetModules()
  const React = await import('react')
  const { render, waitFor, cleanup } = await import('@testing-library/react')
  const { default: Page } = await import('../oauth-google-callback')

  const element = React.createElement(
    React.Fragment,
    null,
    ...Array.from({ length: options.copies ?? 1 }, (_, key) =>
      React.createElement(Page, { key })
    )
  )
  const view = render(
    options.strict
      ? React.createElement(React.StrictMode, null, element)
      : element
  )

  // Must be the instance that rendered, not a freshly imported one.
  cleanupMounted = cleanup

  return { ...view, waitFor }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.backendConfigured = true
  h.exchangeGoogleCode.mockResolvedValue(session)
  sessionStorage.clear()
})

afterEach(() => {
  cleanupMounted()
  cleanupMounted = () => {}
})

describe('successful callback', () => {
  it('exchanges the code with the stored verifier and finishes the login', async () => {
    seedPending({ returnTo: '/study?deck=1' })
    visit('?code=the-code&state=state-abc')

    const { waitFor } = await mount()

    await waitFor(() => expect(h.navigate).toHaveBeenCalled())
    expect(h.exchangeGoogleCode).toHaveBeenCalledWith({
      code: 'the-code',
      codeVerifier: 'verifier-123',
      redirectUri: 'http://localhost:5173/oauth/google/callback'
    })
    expect(h.completeGoogleLogin).toHaveBeenCalledWith(session)
    expect(h.toastSuccess).toHaveBeenCalledWith('Signed in')
    expect(h.navigate).toHaveBeenCalledWith('/study?deck=1', { replace: true })
  })

  it('discards the PKCE state once the exchange is done', async () => {
    seedPending()
    visit('?code=the-code&state=state-abc')

    const { waitFor } = await mount()

    await waitFor(() => expect(h.navigate).toHaveBeenCalled())
    expect(sessionStorage.getItem('auth.pkce')).toBeNull()
  })

  it.each([
    ['an absolute URL', 'https://evil.example/'],
    ['a protocol-relative URL', '//evil.example'],
    ['a missing return path', undefined]
  ])('sends %s back to the home page', async (_label, returnTo) => {
    seedPending(returnTo === undefined ? {} : { returnTo })
    visit('?code=the-code&state=state-abc')

    const { waitFor } = await mount()

    await waitFor(() => expect(h.navigate).toHaveBeenCalled())
    expect(h.navigate).toHaveBeenCalledWith('/', { replace: true })
  })
})

describe('state validation', () => {
  it('rejects a state that does not match and never calls the API', async () => {
    seedPending()
    visit('?code=the-code&state=someone-elses-state')

    const { waitFor } = await mount()

    await waitFor(() => expect(h.navigate).toHaveBeenCalled())
    expect(h.exchangeGoogleCode).not.toHaveBeenCalled()
    expect(h.completeGoogleLogin).not.toHaveBeenCalled()
    expect(h.toastError).toHaveBeenCalledWith(
      'Invalid or expired Google sign-in state.'
    )
  })

  it.each([
    [
      'no stored PKCE state (expired or other tab)',
      false,
      '?code=c&state=state-abc'
    ],
    ['no code', true, '?state=state-abc'],
    ['no state', true, '?code=c']
  ])('rejects %s', async (_label, hasPending, search) => {
    if (hasPending) seedPending()
    visit(search)

    const { waitFor } = await mount()

    await waitFor(() => expect(h.toastError).toHaveBeenCalled())
    expect(h.exchangeGoogleCode).not.toHaveBeenCalled()
    expect(h.completeGoogleLogin).not.toHaveBeenCalled()
  })
})

describe('Google returned an error', () => {
  it('treats access_denied as a cancellation and returns to the stored page', async () => {
    seedPending({ returnTo: '/settings' })
    visit('?error=access_denied')

    const { waitFor } = await mount()

    await waitFor(() => expect(h.navigate).toHaveBeenCalled())
    expect(h.toastError).toHaveBeenCalledWith('Google sign-in was cancelled.')
    expect(h.navigate).toHaveBeenCalledWith('/settings', { replace: true })
    expect(h.exchangeGoogleCode).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('auth.pkce')).toBeNull()
  })

  it('shows Googles description for other errors', async () => {
    seedPending()
    visit('?error=server_error&error_description=Something%20broke')

    const { waitFor } = await mount()

    await waitFor(() => expect(h.toastError).toHaveBeenCalled())
    expect(h.toastError).toHaveBeenCalledWith('Something broke')
    expect(h.exchangeGoogleCode).not.toHaveBeenCalled()
  })

  it('falls back to a generic message when Google gives no description', async () => {
    seedPending()
    visit('?error=server_error')

    const { waitFor } = await mount()

    await waitFor(() => expect(h.toastError).toHaveBeenCalled())
    expect(h.toastError).toHaveBeenCalledWith('Google sign-in failed.')
  })
})

describe('exchange failure', () => {
  it('reports the error, does not sign in, and returns to the stored page', async () => {
    seedPending({ returnTo: '/study' })
    visit('?code=the-code&state=state-abc')
    h.exchangeGoogleCode.mockRejectedValue(new Error('Google exchange failed'))

    const { waitFor } = await mount()

    await waitFor(() => expect(h.navigate).toHaveBeenCalled())
    expect(h.toastError).toHaveBeenCalledWith('Google exchange failed')
    expect(h.completeGoogleLogin).not.toHaveBeenCalled()
    expect(h.navigate).toHaveBeenCalledWith('/study', { replace: true })
    expect(sessionStorage.getItem('auth.pkce')).toBeNull()
  })
})

describe('double-fire guard', () => {
  it('exchanges the single-use code once under React StrictMode', async () => {
    seedPending()
    visit('?code=the-code&state=state-abc')

    const { waitFor } = await mount({ strict: true })

    await waitFor(() => expect(h.completeGoogleLogin).toHaveBeenCalled())
    expect(h.exchangeGoogleCode).toHaveBeenCalledTimes(1)
    expect(h.completeGoogleLogin).toHaveBeenCalledTimes(1)
    expect(h.toastSuccess).toHaveBeenCalledTimes(1)
  })

  it('exchanges the code once when the page mounts twice', async () => {
    seedPending()
    visit('?code=the-code&state=state-abc')

    const { waitFor } = await mount({ copies: 2 })

    await waitFor(() => expect(h.completeGoogleLogin).toHaveBeenCalled())
    expect(h.exchangeGoogleCode).toHaveBeenCalledTimes(1)
  })
})

describe('other conditions', () => {
  it('goes home without calling the API when no backend is configured', async () => {
    h.backendConfigured = false
    seedPending()
    visit('?code=the-code&state=state-abc')

    const { waitFor } = await mount()

    await waitFor(() => expect(h.navigate).toHaveBeenCalled())
    expect(h.navigate).toHaveBeenCalledWith('/', { replace: true })
    expect(h.exchangeGoogleCode).not.toHaveBeenCalled()
  })

  it('does not sign in when the page unmounts before the exchange finishes', async () => {
    seedPending()
    visit('?code=the-code&state=state-abc')
    let resolve: (value: AuthSession) => void = () => {}
    h.exchangeGoogleCode.mockReturnValue(
      new Promise<AuthSession>(r => {
        resolve = r
      })
    )

    const { waitFor, unmount } = await mount()
    await waitFor(() => expect(h.exchangeGoogleCode).toHaveBeenCalled())
    unmount()
    resolve(session)
    await new Promise(r => setTimeout(r, 0))

    expect(h.completeGoogleLogin).not.toHaveBeenCalled()
    expect(h.navigate).not.toHaveBeenCalled()
  })
})
