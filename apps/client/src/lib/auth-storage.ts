import { getSupabaseAuthStorageKey } from '@/lib/supabase'
import { resolveBackendProvider } from '@/providers/resolve-provider'

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
}

type SupabaseStoredSession = {
  access_token?: string
  refresh_token?: string
  expires_at?: number
  user?: AuthUser
}

export function mapSupabaseSession(
  session: SupabaseStoredSession
): AuthSession | null {
  const email = session.user?.email
  if (
    !session.access_token ||
    !session.refresh_token ||
    !session.user?.id ||
    !email
  ) {
    return null
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: (session.expires_at ?? 0) * 1000,
    user: {
      id: session.user.id,
      email,
      user_metadata: session.user.user_metadata
    }
  }
}

function readCustomSession(): AuthSession | null {
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

function readSupabaseSession(): AuthSession | null {
  const raw = localStorage.getItem(getSupabaseAuthStorageKey())
  if (!raw) return null
  try {
    return mapSupabaseSession(JSON.parse(raw) as SupabaseStoredSession)
  } catch {
    return null
  }
}

export function getAuthSession(): AuthSession | null {
  const provider = resolveBackendProvider()
  if (provider === 'custom') return readCustomSession()
  if (provider === 'supabase') return readSupabaseSession()
  return null
}

/** Custom provider only — Supabase owns `sb-*-auth-token`. */
export function setAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}

/** Custom provider only — Supabase clears via `supabase.auth.signOut()`. */
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
