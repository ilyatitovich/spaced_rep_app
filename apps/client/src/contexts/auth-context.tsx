import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import {
  browserSupportsWebAuthn,
  startAuthentication
} from '@simplewebauthn/browser'

import {
  ensureFreshSession,
  isAuthConfigured,
  isGoogleAuthConfigured,
  logoutAuthSession,
  passkeyLoginOptions,
  passkeyLoginVerify,
  requestEmailOtp,
  verifyEmailOtp as verifyEmailOtpApi
} from '@/lib/api'
import {
  clearAuthSession,
  getAuthSession,
  setPkcePending,
  type AuthSession,
  type AuthUser
} from '@/lib/auth-storage'
import { completeOnboarding } from '@/lib/onboarding'
import {
  buildGoogleAuthorizeUrl,
  createPkcePair,
  googleRedirectUri
} from '@/lib/pkce'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { setSyncUser, initialSync } from '@/services'
import { useSettingsStore } from '@/store/settings-store'

type AuthContextValue = {
  session: AuthSession | null
  user: AuthUser | null
  isLoading: boolean
  isConfigured: boolean
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  signInWithPasskey: () => Promise<void>
  sendEmailOtp: (email: string, turnstileToken: string) => Promise<void>
  verifyEmailOtp: (email: string, token: string) => Promise<void>
  signOut: () => Promise<void>
  /** Used by OAuth callback route after exchanging the code. */
  completeGoogleLogin: (session: AuthSession) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function toAuthUser(user: SupabaseUser): AuthUser | null {
  if (!user.email) return null
  return { id: user.id, email: user.email }
}

function isWebAuthnAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'NotAllowedError' || error.name === 'AbortError')
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    getAuthSession()
  )
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(
    () => isAuthConfigured() || isSupabaseConfigured
  )

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (isAuthConfigured()) {
        const fresh = await ensureFreshSession()
        if (!cancelled) setSession(fresh)
      }

      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession()
        if (!cancelled) setSupabaseUser(data.session?.user ?? null)
      }

      if (!cancelled) setIsLoading(false)
    }

    void bootstrap()

    if (!isSupabaseConfigured) {
      return () => {
        cancelled = true
      }
    }

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSupabaseUser(nextSession?.user ?? null)
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  const user = session?.user ?? (supabaseUser ? toAuthUser(supabaseUser) : null)
  const userId = user?.id ?? null

  useEffect(() => {
    void useSettingsStore.getState().loadLocal()
  }, [])

  useEffect(() => {
    setSyncUser(userId)
    useSettingsStore.getState().setUser(userId)
    if (userId) {
      void initialSync(userId)
      void useSettingsStore.getState().pullRemote(userId)
    } else {
      void useSettingsStore.getState().loadLocal()
    }
  }, [userId])

  const value = useMemo<AuthContextValue>(() => {
    return {
      session,
      user,
      isLoading,
      isConfigured: isAuthConfigured() || isSupabaseConfigured,
      signInWithGoogle: async () => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
        if (!clientId || !isGoogleAuthConfigured()) {
          throw new Error('Google sign-in is not configured')
        }

        const { codeVerifier, codeChallenge, state } = await createPkcePair()
        const redirectUri = googleRedirectUri()
        setPkcePending({ codeVerifier, state })
        window.location.assign(
          buildGoogleAuthorizeUrl({
            clientId,
            redirectUri,
            codeChallenge,
            state
          })
        )
      },
      signInWithApple: async () => {
        if (!isSupabaseConfigured) return
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: { redirectTo: window.location.origin }
        })
        if (error) throw error
        completeOnboarding()
      },
      signInWithPasskey: async () => {
        if (!isAuthConfigured()) {
          throw new Error('Passkey sign-in is not configured')
        }
        if (!browserSupportsWebAuthn()) {
          throw new Error('Passkeys aren’t supported in this browser')
        }

        const options = await passkeyLoginOptions()
        let credential
        try {
          credential = await startAuthentication({ optionsJSON: options })
        } catch (err) {
          if (isWebAuthnAbort(err)) {
            throw new Error('Passkey sign-in was cancelled')
          }
          throw err
        }

        const next = await passkeyLoginVerify({ credential })
        setSession(next)
        completeOnboarding()
      },
      sendEmailOtp: async (email: string, turnstileToken: string) => {
        if (!isAuthConfigured()) {
          throw new Error('Email sign-in is not configured')
        }
        await requestEmailOtp({ email, turnstileToken })
      },
      verifyEmailOtp: async (email: string, token: string) => {
        if (!isAuthConfigured()) {
          throw new Error('Email sign-in is not configured')
        }
        const next = await verifyEmailOtpApi({ email, code: token })
        setSession(next)
        completeOnboarding()
      },
      signOut: async () => {
        const accessToken = getAuthSession()?.accessToken
        if (accessToken) {
          await logoutAuthSession(accessToken)
        } else {
          clearAuthSession()
        }
        setSession(null)
        if (isSupabaseConfigured) {
          await supabase.auth.signOut()
        }
      },
      completeGoogleLogin: (next: AuthSession) => {
        setSession(next)
        completeOnboarding()
      }
    }
  }, [session, user, isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
