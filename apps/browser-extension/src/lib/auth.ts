import { startAuthentication } from '@simplewebauthn/browser'
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser'

import type { ExtensionSession } from '../types'

const SESSION_KEY = 'auth.session'
export const API_URL = (
  import.meta.env.WXT_PUBLIC_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')

type TokenResponse = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; email: string }
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
    throw new Error(payload.error?.message ?? 'Authentication failed')
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

export async function requestEmailOtp(
  email: string,
  turnstileToken: string
): Promise<void> {
  await post('/auth/email/request', { email, turnstileToken })
}

export async function verifyEmailOtp(
  email: string,
  code: string
): Promise<ExtensionSession> {
  const tokens = await post<TokenResponse>('/auth/email/verify', {
    email,
    code
  })
  return persist(toSession(tokens))
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
  } catch {
    await chrome.storage.local.remove(SESSION_KEY)
    return null
  }
}

export async function signOut(): Promise<void> {
  await chrome.storage.local.remove(SESSION_KEY)
}
