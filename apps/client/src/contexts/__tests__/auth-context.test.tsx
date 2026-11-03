import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { getAuthSession, setAuthSession } from '@/lib/auth-storage'
import type { AuthSession } from '@/lib/auth-storage'
import type { AuthPort } from '@/providers'

const h = vi.hoisted(() => ({
  auth: null as AuthPort | null,
  configured: true,
  listeners: new Set<(session: AuthSession | null) => void>(),
  settings: {
    loadLocal: vi.fn(async () => {}),
    setUser: vi.fn(),
    pullRemote: vi.fn(async () => {}),
    hasPlan: vi.fn(() => false),
    settings: null as null | { notifications: { reminders: unknown[] } }
  },
  initialSync: vi.fn(async () => {}),
  // Like the real one: reports whether sync should start for this entitlement.
  setSyncEntitlement: vi.fn((entitled: boolean) => entitled),
  setSyncUser: vi.fn(),
  ensurePushSubscription: vi.fn(async () => {})
}))

// `auth` is read as a live binding, so a getter lets each test swap the port.
vi.mock('@/providers', () => ({
  get auth() {
    return h.auth
  },
  isBackendConfigured: () => h.configured
}))
vi.mock('@/services', () => ({
  initialSync: h.initialSync,
  setSyncEntitlement: h.setSyncEntitlement,
  setSyncUser: h.setSyncUser
}))
vi.mock('@/services/push.service', () => ({
  ensurePushSubscription: h.ensurePushSubscription
}))
vi.mock('@/store/settings-store', () => ({
  useSettingsStore: { getState: () => h.settings }
}))

const alice: AuthSession = {
  accessToken: 'alice-access',
  refreshToken: 'alice-refresh',
  expiresAt: Date.now() + 900_000,
  user: { id: 'alice', email: 'alice@example.com' }
}
const bob: AuthSession = {
  accessToken: 'bob-access',
  refreshToken: 'bob-refresh',
  expiresAt: Date.now() + 900_000,
  user: { id: 'bob', email: 'bob@example.com' }
}

function makeAuth(overrides: Partial<AuthPort> = {}) {
  const port: AuthPort = {
    capabilities: { google: true, passkey: true, emailOtp: true },
    getSession: vi.fn(async () => null),
    getCurrentUser: vi.fn(async () => null),
    getAccessToken: vi.fn(async () => null),
    refreshSession: vi.fn(async () => getAuthSession()),
    loginWithGoogle: vi.fn(async () => {}),
    loginWithPasskey: vi.fn(async () => {}),
    requestEmailOtp: vi.fn(async () => {}),
    verifyEmailOtp: vi.fn(async () => alice),
    logout: vi.fn(async () => {}),
    onAuthStateChange: vi.fn(cb => {
      h.listeners.add(cb)
      return () => {
        h.listeners.delete(cb)
      }
    }),
    ...overrides
  }
  h.auth = port
  return port
}

function emit(session: AuthSession | null) {
  act(() => {
    for (const cb of h.listeners) cb(session)
  })
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

/** Render and wait for the bootstrap refresh to finish. */
async function mountSettled() {
  const view = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(view.result.current.isLoading).toBe(false))
  return view
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  h.listeners.clear()
  h.configured = true
  h.settings.hasPlan.mockReturnValue(false)
  h.settings.pullRemote.mockImplementation(async () => {})
  makeAuth()
})

describe('useAuth', () => {
  it('throws outside an AuthProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    )
  })
})

describe('bootstrap', () => {
  it('starts from the stored session while the refresh is in flight', async () => {
    setAuthSession(alice)
    let finish: (value: AuthSession | null) => void = () => {}
    makeAuth({
      refreshSession: vi.fn(
        () =>
          new Promise<AuthSession | null>(resolve => {
            finish = resolve
          })
      )
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.user).toEqual(alice.user)

    await act(async () => finish(alice))
    expect(result.current.isLoading).toBe(false)
  })

  it('adopts the refreshed session', async () => {
    setAuthSession(alice)
    const rotated = { ...alice, accessToken: 'rotated' }
    makeAuth({ refreshSession: vi.fn(async () => rotated) })

    const { result } = await mountSettled()

    expect(result.current.session).toEqual(rotated)
  })

  it('signs the user out when the refresh is rejected by the server', async () => {
    setAuthSession(alice)
    makeAuth({ refreshSession: vi.fn(async () => null) })

    const { result } = await mountSettled()

    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
  })

  it('finishes loading and keeps the stored session when the refresh throws', async () => {
    setAuthSession(alice)
    makeAuth({
      refreshSession: vi.fn(async () => {
        throw new Error('storage unavailable')
      })
    })

    const { result } = await mountSettled()

    expect(result.current.isLoading).toBe(false)
    expect(result.current.user).toEqual(alice.user)
  })

  it('is not loading and does not call the backend when none is configured', async () => {
    h.configured = false
    h.auth = null

    const { result } = await mountSettled()

    expect(result.current.isConfigured).toBe(false)
    expect(result.current.session).toBeNull()
    expect(result.current.capabilities).toEqual({
      google: false,
      passkey: false,
      emailOtp: false
    })
  })

  it('ignores a refresh that finishes after the provider unmounted', async () => {
    setAuthSession(alice)
    let finish: (value: AuthSession | null) => void = () => {}
    makeAuth({
      refreshSession: vi.fn(
        () =>
          new Promise<AuthSession | null>(resolve => {
            finish = resolve
          })
      )
    })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = renderHook(() => useAuth(), { wrapper })

    unmount()
    await act(async () => finish(bob))

    expect(errors).not.toHaveBeenCalled()
  })
})

describe('auth state changes from the provider', () => {
  it('follows sign-ins and sign-outs pushed by the adapter', async () => {
    const { result } = await mountSettled()

    emit(alice)
    expect(result.current.user).toEqual(alice.user)
    expect(localStorage.getItem('onboardingComplete')).toBe('true')

    emit(null)
    expect(result.current.user).toBeNull()
  })

  it('stops listening once unmounted', async () => {
    const { unmount } = await mountSettled()
    expect(h.listeners.size).toBe(1)

    unmount()

    expect(h.listeners.size).toBe(0)
  })
})

describe('signing in', () => {
  it('verifyEmailOtp stores the new session and completes onboarding', async () => {
    const { result } = await mountSettled()

    await act(() =>
      result.current.verifyEmailOtp('alice@example.com', '123456')
    )

    expect(h.auth?.verifyEmailOtp).toHaveBeenCalledWith(
      'alice@example.com',
      '123456'
    )
    expect(result.current.session).toEqual(alice)
    expect(localStorage.getItem('onboardingComplete')).toBe('true')
  })

  it('verifyEmailOtp leaves the user signed out when the code is wrong', async () => {
    makeAuth({
      verifyEmailOtp: vi.fn(async () => {
        throw new Error('Invalid or expired code')
      })
    })
    const { result } = await mountSettled()

    await expect(
      act(() => result.current.verifyEmailOtp('alice@example.com', '000000'))
    ).rejects.toThrow('Invalid or expired code')

    expect(result.current.session).toBeNull()
    expect(localStorage.getItem('onboardingComplete')).toBeNull()
  })

  it('sendEmailOtp forwards the email and Turnstile token', async () => {
    const { result } = await mountSettled()

    await act(() => result.current.sendEmailOtp('a@b.com', 'turnstile'))

    expect(h.auth?.requestEmailOtp).toHaveBeenCalledWith('a@b.com', 'turnstile')
  })

  it.each([
    ['sendEmailOtp', 'emailOtp', 'Email sign-in is not configured'],
    ['verifyEmailOtp', 'emailOtp', 'Email sign-in is not configured'],
    ['signInWithPasskey', 'passkey', 'Passkey sign-in is not configured'],
    ['signInWithGoogle', 'google', 'Google sign-in is not configured']
  ] as const)(
    '%s refuses when %s is not a capability',
    async (method, capability, message) => {
      makeAuth({
        capabilities: {
          google: true,
          passkey: true,
          emailOtp: true,
          [capability]: false
        }
      })
      const { result } = await mountSettled()

      await expect(
        act(() => result.current[method]('a@b.com', 'x'))
      ).rejects.toThrow(message)
    }
  )

  it('signInWithPasskey adopts the session the adapter ends up with', async () => {
    makeAuth({
      loginWithPasskey: vi.fn(async () => {}),
      getSession: vi.fn(async () => bob)
    })
    const { result } = await mountSettled()

    await act(() => result.current.signInWithPasskey())

    expect(result.current.user).toEqual(bob.user)
    expect(localStorage.getItem('onboardingComplete')).toBe('true')
  })

  it('signInWithPasskey changes nothing when the ceremony is cancelled', async () => {
    makeAuth({
      loginWithPasskey: vi.fn(async () => {
        throw new Error('Passkey sign-in was cancelled')
      })
    })
    const { result } = await mountSettled()

    await expect(act(() => result.current.signInWithPasskey())).rejects.toThrow(
      'Passkey sign-in was cancelled'
    )

    expect(result.current.session).toBeNull()
  })

  it('signInWithPasskey changes nothing when no session came back', async () => {
    const { result } = await mountSettled()

    await act(() => result.current.signInWithPasskey())

    expect(result.current.session).toBeNull()
  })

  it('signInWithGoogle starts the redirect without touching the session', async () => {
    const { result } = await mountSettled()

    await act(() => result.current.signInWithGoogle())

    expect(h.auth?.loginWithGoogle).toHaveBeenCalledTimes(1)
    expect(result.current.session).toBeNull()
  })

  it('completeGoogleLogin stores the session from the OAuth callback', async () => {
    const { result } = await mountSettled()

    act(() => result.current.completeGoogleLogin(alice))

    expect(result.current.session).toEqual(alice)
    expect(localStorage.getItem('onboardingComplete')).toBe('true')
  })
})

describe('signing out', () => {
  it('calls the adapter and clears the session', async () => {
    setAuthSession(alice)
    const { result } = await mountSettled()
    expect(result.current.user).toEqual(alice.user)

    await act(() => result.current.signOut())

    expect(h.auth?.logout).toHaveBeenCalledTimes(1)
    expect(result.current.session).toBeNull()
  })

  it('clears the stored session itself when no backend is configured', async () => {
    h.configured = false
    h.auth = null
    setAuthSession(alice)
    const { result } = await mountSettled()

    await act(() => result.current.signOut())

    expect(getAuthSession()).toBeNull()
    expect(result.current.session).toBeNull()
  })

  it('still signs the user out locally when the adapter fails', async () => {
    setAuthSession(alice)
    makeAuth({
      logout: vi.fn(async () => {
        throw new Error('network down')
      })
    })
    const { result } = await mountSettled()

    await act(async () => {
      await result.current.signOut().catch(() => {})
    })

    expect(result.current.session).toBeNull()
  })
})

describe('what follows a user change', () => {
  it('tells sync and settings who signed in and pulls their settings', async () => {
    const { result } = await mountSettled()

    act(() => result.current.completeGoogleLogin(alice))

    await waitFor(() =>
      expect(h.settings.pullRemote).toHaveBeenCalledWith('alice')
    )
    expect(h.setSyncUser).toHaveBeenLastCalledWith('alice')
    expect(h.settings.setUser).toHaveBeenLastCalledWith('alice')
  })

  it('runs the first sync only for an entitled user', async () => {
    h.settings.hasPlan.mockReturnValue(true)
    const { result } = await mountSettled()

    act(() => result.current.completeGoogleLogin(alice))

    await waitFor(() => expect(h.initialSync).toHaveBeenCalledWith('alice'))
    expect(h.setSyncEntitlement).toHaveBeenCalledWith(true)
  })

  it('does not sync a free user', async () => {
    const { result } = await mountSettled()

    act(() => result.current.completeGoogleLogin(alice))

    await waitFor(() =>
      expect(h.setSyncEntitlement).toHaveBeenCalledWith(false)
    )
    expect(h.initialSync).not.toHaveBeenCalled()
  })

  it('switches sync off and reloads local settings on sign-out', async () => {
    setAuthSession(alice)
    const { result } = await mountSettled()
    vi.clearAllMocks()

    await act(() => result.current.signOut())

    expect(h.setSyncUser).toHaveBeenLastCalledWith(null)
    expect(h.settings.setUser).toHaveBeenLastCalledWith(null)
    expect(h.setSyncEntitlement).toHaveBeenLastCalledWith(false)
    expect(h.settings.loadLocal).toHaveBeenCalled()
  })

  it('does not start a sync for a user who signed out while settings were loading', async () => {
    h.settings.hasPlan.mockReturnValue(true)
    let finishPull: () => void = () => {}
    h.settings.pullRemote.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finishPull = resolve
        })
    )
    const { result } = await mountSettled()

    act(() => result.current.completeGoogleLogin(alice))
    await waitFor(() => expect(h.settings.pullRemote).toHaveBeenCalled())
    await act(() => result.current.signOut())
    await act(async () => finishPull())

    expect(h.initialSync).not.toHaveBeenCalled()
  })

  it('does not leak the previous users sync when another user signs in', async () => {
    h.settings.hasPlan.mockReturnValue(true)
    const { result } = await mountSettled()

    act(() => result.current.completeGoogleLogin(alice))
    await waitFor(() => expect(h.initialSync).toHaveBeenCalledWith('alice'))
    act(() => result.current.completeGoogleLogin(bob))

    await waitFor(() => expect(h.initialSync).toHaveBeenCalledWith('bob'))
    expect(h.setSyncUser).toHaveBeenLastCalledWith('bob')
  })
})
