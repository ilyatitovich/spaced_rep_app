import { createContext, useContext, useMemo, type ReactNode } from 'react'

import {
  requestEmailOtp,
  signInWithPasskey as signInWithPasskeyRequest,
  signOut as signOutSession,
  verifyEmailOtp as verifyEmailOtpRequest
} from '../lib/auth'
import type { ExtensionSession } from '../types'
import { unavailable } from '@ext/lib'

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
      capabilities: { google: false, passkey: true, emailOtp: true },
      signInWithGoogle: unavailable('Google sign-in'),
      signInWithPasskey: async () => {
        await signInWithPasskeyRequest()
      },
      sendEmailOtp: requestEmailOtp,
      verifyEmailOtp: async (email, token) => {
        await verifyEmailOtpRequest(email, token)
      },
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
