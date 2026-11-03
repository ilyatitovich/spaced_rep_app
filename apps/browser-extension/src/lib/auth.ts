import { startAuthentication } from '@simplewebauthn/browser'
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser'

import type { ExtensionSession } from '@ext/types'

const SESSION_KEY = 'auth.session'
export const API_URL = (
  import.meta.env.WXT_PUBLIC_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')

interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; email: string }
}

class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const payload = (await response.json()) as {
    data?: T
    error?: { message?: string }
  }
  if (!response.ok || !payload.data) {
    throw new AuthRequestError(
      payload.error?.message ?? 'Authentication failed',
      response.status
    )
  }
  return payload.data
}

function toSession(tokens: TokenResponse): ExtensionSession {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    user: tokens.user
  }
}

async function persist(session: ExtensionSession): Promise<ExtensionSession> {
  await chrome.storage.local.set({ [SESSION_KEY]: session })
  return session
}

function isWebAuthnAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'NotAllowedError' || error.name === 'AbortError')
  )
}

export async function signInWithPasskey(): Promise<ExtensionSession> {
  const options = await post<PublicKeyCredentialRequestOptionsJSON>(
    '/auth/passkeys/login/options',
    {}
  )
  let credential: AuthenticationResponseJSON
  try {
    credential = await startAuthentication({ optionsJSON: options })
  } catch (error) {
    if (isWebAuthnAbort(error)) {
      throw new Error('Passkey sign-in was cancelled')
    }
    throw error
  }
  const tokens = await post<TokenResponse>('/auth/passkeys/login/verify', {
    credential
  })
  return persist(toSession(tokens))
}

export async function getSession(): Promise<ExtensionSession | null> {
  const stored = await chrome.storage.local.get(SESSION_KEY)
  return (stored[SESSION_KEY] as ExtensionSession | undefined) ?? null
}

export async function freshSession(): Promise<ExtensionSession | null> {
  const session = await getSession()
  if (!session || session.expiresAt > Date.now() + 60_000) return session
  try {
    return persist(
      toSession(
        await post<TokenResponse>('/auth/token/refresh', {
          refreshToken: session.refreshToken
        })
      )
    )
  } catch (error) {
    // Only an explicit rejection means the refresh token is dead. Offline,
    // 5xx and gateway errors say nothing about it: keep the session.
    if (
      error instanceof AuthRequestError &&
      (error.status === 401 || error.status === 403)
    ) {
      await chrome.storage.local.remove(SESSION_KEY)
      return null
    }
    return session
  }
}

export async function signOut(): Promise<void> {
  const session = await getSession()
  if (session?.accessToken) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`
        },
        body: '{}'
      })
    } catch {
      // Best-effort revoke; always clear local session.
    }
  }
  await chrome.storage.local.remove(SESSION_KEY)
}
