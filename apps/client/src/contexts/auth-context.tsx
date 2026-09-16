import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

import {
  clearAuthSession,
  getAuthSession,
  type AuthSession,
  type AuthUser
} from '@/lib/auth-storage'
import { completeOnboarding } from '@/lib/onboarding'
import { auth, isBackendConfigured } from '@/providers'
import type { AuthCapabilities } from '@/providers'
import { setSyncUser, initialSync } from '@/services'
import { useSettingsStore } from '@/store/settings-store'

type AuthContextValue = {
  session: AuthSession | null
  user: AuthUser | null
  isLoading: boolean
  isConfigured: boolean
  capabilities: AuthCapabilities
  signInWithGoogle: () => Promise<void>
  signInWithPasskey: () => Promise<void>
  sendEmailOtp: (email: string, turnstileToken: string) => Promise<void>
  verifyEmailOtp: (email: string, token: string) => Promise<void>
  signOut: () => Promise<void>
  /** Used by OAuth callback route after exchanging the code (custom provider). */
  completeGoogleLogin: (session: AuthSession) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const emptyCapabilities: AuthCapabilities = {
  google: false,
  passkey: false,
  emailOtp: false
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    getAuthSession()
  )

  const [isLoading, setIsLoading] = useState(() => isBackendConfigured())

  useEffect(() => {
    if (!auth) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function bootstrap() {
      const fresh = await auth!.refreshSession()
      if (!cancelled) {
        setSession(fresh)
        setIsLoading(false)
      }
    }

    void bootstrap()

    const unsubscribe = auth.onAuthStateChange(next => {
      setSession(next)
      if (next) completeOnboarding()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const user = session?.user ?? null
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
      isConfigured: isBackendConfigured(),
      capabilities: auth?.capabilities ?? emptyCapabilities,
      signInWithGoogle: async () => {
        if (!auth?.capabilities.google) {
          throw new Error('Google sign-in is not configured')
        }
        await auth.loginWithGoogle()
      },
      signInWithPasskey: async () => {
        if (!auth?.capabilities.passkey) {
          throw new Error('Passkey sign-in is not configured')
        }
        await auth.loginWithPasskey()
        const next = await auth.getSession()
        if (next) {
          setSession(next)
          completeOnboarding()
        }
      },
      sendEmailOtp: async (email: string, turnstileToken: string) => {
        if (!auth?.capabilities.emailOtp) {
          throw new Error('Email sign-in is not configured')
        }
        await auth.requestEmailOtp(email, turnstileToken)
      },
      verifyEmailOtp: async (email: string, token: string) => {
        if (!auth?.capabilities.emailOtp) {
          throw new Error('Email sign-in is not configured')
        }
        const next = await auth.verifyEmailOtp(email, token)
        setSession(next)
        completeOnboarding()
      },
      signOut: async () => {
        if (auth) {
          await auth.logout()
        } else {
          clearAuthSession()
        }
        setSession(null)
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
