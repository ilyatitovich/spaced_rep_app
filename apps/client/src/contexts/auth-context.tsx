import type { Provider, Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { completeOnboarding } from '@/lib'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { initialSync, setSyncUser } from '@/services'

type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
  isConfigured: boolean
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  sendEmailOtp: (email: string) => Promise<void>
  verifyEmailOtp: (email: string, token: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    setSyncUser(userId)
    if (userId) {
      void initialSync(userId)
    }
  }, [userId])

  const value = useMemo<AuthContextValue>(() => {
    const signIn = async (provider: Provider): Promise<void> => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin }
      })
      if (error) throw error
      completeOnboarding()
    }

    const sendEmailOtp = async (email: string): Promise<void> => {
      if (!isSupabaseConfigured) return
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true }
      })
      if (error) throw error
    }

    const verifyEmailOtp = async (
      email: string,
      token: string
    ): Promise<void> => {
      if (!isSupabaseConfigured) return
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      })
      if (error) throw error
      completeOnboarding()
    }

    return {
      session,
      user: session?.user ?? null,
      isLoading,
      isConfigured: isSupabaseConfigured,
      signInWithGoogle: () => signIn('google'),
      signInWithApple: () => signIn('apple'),
      sendEmailOtp,
      verifyEmailOtp,
      signOut: async () => {
        await supabase.auth.signOut()
      }
    }
  }, [session, isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
