import type { ExtensionSession } from '../types'

const SESSION_KEY = 'auth.session'
const API_URL = (
  import.meta.env.WXT_PUBLIC_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')
const APP_URL = (
  import.meta.env.WXT_PUBLIC_APP_URL ?? 'http://localhost:5173'
).replace(/\/$/, '')

type TokenResponse = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; email: string }
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createPkce(): Promise<{
  verifier: string
  challenge: string
  state: string
}> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  )
  return {
    verifier,
    challenge: base64Url(new Uint8Array(digest)),
    state: base64Url(crypto.getRandomValues(new Uint8Array(24)))
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

export async function signIn(): Promise<ExtensionSession> {
  const { verifier, challenge, state } = await createPkce()
  const redirectUri = chrome.identity.getRedirectURL('authorized')
  const url = new URL('/extension/authorize', APP_URL)
  url.search = new URLSearchParams({
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge
  }).toString()

  const result = await chrome.identity.launchWebAuthFlow({
    url: url.toString(),
    interactive: true
  })
  if (!result) throw new Error('Authentication was cancelled')
  const callback = new URL(result)
  if (callback.searchParams.get('state') !== state) {
    throw new Error('Invalid authentication state')
  }
  const code = callback.searchParams.get('code')
  if (!code) throw new Error(callback.searchParams.get('error') ?? 'No code')

  const tokens = await post<TokenResponse>('/auth/extension/token', {
    code,
    codeVerifier: verifier,
    redirectUri
  })
  const session = toSession(tokens)
  await chrome.storage.local.set({ [SESSION_KEY]: session })
  return session
}

export async function getSession(): Promise<ExtensionSession | null> {
  const stored = await chrome.storage.local.get(SESSION_KEY)
  return (stored[SESSION_KEY] as ExtensionSession | undefined) ?? null
}

export async function freshSession(): Promise<ExtensionSession | null> {
  const session = await getSession()
  if (!session || session.expiresAt > Date.now() + 60_000) return session
  try {
    const tokens = await post<TokenResponse>('/auth/token/refresh', {
      refreshToken: session.refreshToken
    })
    const next = toSession(tokens)
    await chrome.storage.local.set({ [SESSION_KEY]: next })
    return next
  } catch {
    await chrome.storage.local.remove(SESSION_KEY)
    return null
  }
}

export async function signOut(): Promise<void> {
  await chrome.storage.local.remove(SESSION_KEY)
}

export { API_URL }
