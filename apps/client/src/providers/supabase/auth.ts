import type { Session as SupabaseSession } from '@supabase/supabase-js'
import {
  clearAuthSession,
  setAuthSession,
  type AuthSession
} from '@/lib/auth-storage'
import { supabase } from '@/lib/supabase'
import type { AuthPort } from '../types'

function toAuthSession(session: SupabaseSession): AuthSession | null {
  const email = session.user.email
  if (!email) return null
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: (session.expires_at ?? 0) * 1000,
    user: { id: session.user.id, email }
  }
}

function persist(session: SupabaseSession | null): AuthSession | null {
  if (!session) {
    clearAuthSession()
    return null
  }
  const mapped = toAuthSession(session)
  if (mapped) setAuthSession(mapped)
  else clearAuthSession()
  return mapped
}

export function createSupabaseAuthAdapter(): AuthPort {
  return {
    capabilities: {
      google: true,
      passkey: false,
      emailOtp: false
    },

    async getSession() {
      const { data } = await supabase.auth.getSession()
      return persist(data.session)
    },

    async getCurrentUser() {
      const { data } = await supabase.auth.getSession()
      return persist(data.session)?.user ?? null
    },

    async getAccessToken() {
      const session = await this.refreshSession()
      return session?.accessToken ?? null
    },

    async refreshSession() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        clearAuthSession()
        return null
      }
      const skewMs = 60_000
      const expiresAt = (data.session.expires_at ?? 0) * 1000
      if (expiresAt > Date.now() + skewMs) {
        return persist(data.session)
      }
      const { data: refreshed, error } = await supabase.auth.refreshSession()
      if (error || !refreshed.session) {
        clearAuthSession()
        return null
      }
      return persist(refreshed.session)
    },

    async loginWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      })
      if (error) throw error
    },

    async loginWithPasskey() {
      throw new Error('Passkey sign-in is not available')
    },

    async requestEmailOtp() {
      throw new Error('Email sign-in is not available')
    },

    async verifyEmailOtp() {
      throw new Error('Email sign-in is not available')
    },

    async logout() {
      await supabase.auth.signOut()
      clearAuthSession()
    },

    onAuthStateChange(cb) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        cb(persist(session))
      })
      return () => data.subscription.unsubscribe()
    }
  }
}
