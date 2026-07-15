import {
  clearAuthSession,
  getAuthSession,
  setAuthSession,
  type AuthSession,
  type AuthUser
} from './auth-storage'

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''

export type AuthTokenResponse = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
  user: AuthUser
}

type ApiErrorBody = {
  error?: { code?: string; message?: string }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
  }
}

function sessionFromTokenResponse(data: AuthTokenResponse): AuthSession {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + data.expiresIn * 1000,
    user: data.user
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & ApiErrorBody
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.message ?? response.statusText,
      body.error?.code
    )
  }
  return body
}

async function postJson<T>(
  path: string,
  body: unknown,
  init?: { accessToken?: string }
): Promise<T> {
  if (!apiUrl) {
    throw new ApiError(0, 'VITE_API_URL is not configured')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (init?.accessToken) {
    headers.Authorization = `Bearer ${init.accessToken}`
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  const json = await parseJson<{ data: T }>(response)
  return json.data
}

async function getJson<T>(
  path: string,
  accessToken: string
): Promise<T> {
  if (!apiUrl) {
    throw new ApiError(0, 'VITE_API_URL is not configured')
  }

  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const json = await parseJson<{ data: T }>(response)
  return json.data
}

let refreshInFlight: Promise<AuthSession | null> | null = null

export async function exchangeGoogleCode(input: {
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<AuthSession> {
  const data = await postJson<AuthTokenResponse>(
    '/auth/oauth/google/callback',
    input
  )
  const session = sessionFromTokenResponse(data)
  setAuthSession(session)
  return session
}

export async function refreshAuthSession(
  refreshToken: string
): Promise<AuthSession> {
  const data = await postJson<AuthTokenResponse>('/auth/token/refresh', {
    refreshToken
  })
  const session = sessionFromTokenResponse(data)
  setAuthSession(session)
  return session
}

export async function logoutAuthSession(accessToken: string): Promise<void> {
  try {
    await postJson<{ ok: true }>('/auth/logout', {}, { accessToken })
  } catch {
    // best-effort
  } finally {
    clearAuthSession()
  }
}

export async function fetchMe(
  accessToken: string
): Promise<{ user: AuthUser }> {
  return getJson('/auth/me', accessToken)
}

/** Single-flight refresh used on cold start / near-expiry. */
export function ensureFreshSession(): Promise<AuthSession | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const current = getAuthSession()
    if (!current) return null

    const skewMs = 60_000
    if (current.expiresAt > Date.now() + skewMs) {
      return current
    }

    try {
      return await refreshAuthSession(current.refreshToken)
    } catch {
      clearAuthSession()
      return null
    }
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

export function isAuthConfigured(): boolean {
  return Boolean(apiUrl && import.meta.env.VITE_GOOGLE_CLIENT_ID)
}
