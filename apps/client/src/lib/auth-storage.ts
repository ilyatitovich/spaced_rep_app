const AUTH_SESSION_KEY = 'auth.session'
const PKCE_KEY = 'auth.pkce'

export type AuthUser = {
  id: string
  email: string
  user_metadata?: Record<string, string>
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: AuthUser
}

export type PkcePending = {
  codeVerifier: string
  state: string
  /** Path + search to restore after OAuth (auth param already stripped). */
  returnTo?: string
}

/** Same-origin relative path only; rejects open redirects. */
export function safeAuthReturnTo(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export function captureAuthReturnTo(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('auth')
  return safeAuthReturnTo(`${url.pathname}${url.search}`)
}

export function getAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AuthSession
    if (
      !parsed?.accessToken ||
      !parsed?.refreshToken ||
      !parsed?.user?.id ||
      !parsed?.user?.email
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function setAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_SESSION_KEY)
}

export function setPkcePending(pending: PkcePending): void {
  sessionStorage.setItem(PKCE_KEY, JSON.stringify(pending))
}

export function getPkcePending(): PkcePending | null {
  const raw = sessionStorage.getItem(PKCE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PkcePending
  } catch {
    return null
  }
}

export function clearPkcePending(): void {
  sessionStorage.removeItem(PKCE_KEY)
}
