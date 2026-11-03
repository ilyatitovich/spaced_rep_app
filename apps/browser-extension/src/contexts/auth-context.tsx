import { createContext, useContext, useMemo, type ReactNode } from 'react'

import {
  signInWithPasskey as signInWithPasskeyRequest,
  signOut as signOutSession,
  unavailable
} from '@ext/lib'
import type { ExtensionSession } from '@ext/types'

interface AuthContextValue {
  session: ExtensionSession | null
  isConfigured: boolean
  capabilities: { google: boolean; passkey: boolean; emailOtp: boolean }
  signInWithGoogle: () => Promise<void>
  signInWithPasskey: () => Promise<void>
  sendEmailOtp: (email: string, turnstileToken: string) => Promise<void>
  verifyEmailOtp: (email: string, token: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({
      session: null,
      isConfigured: true,
      capabilities: { google: false, passkey: true, emailOtp: false },
      signInWithGoogle: unavailable('Google sign-in'),
      signInWithPasskey: async () => {
        await signInWithPasskeyRequest()
      },
      sendEmailOtp: unavailable('Email sign-in'),
      verifyEmailOtp: unavailable('Email sign-in'),
      signOut: signOutSession
    }),
    []
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
