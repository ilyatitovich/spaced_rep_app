import type { Session as SupabaseSession } from '@supabase/supabase-js'
import { mapSupabaseSession, type AuthSession } from '@/lib/auth-storage'
import { supabase } from '@/lib/supabase'
import type { AuthPort } from '../types'

function toAuthSession(session: SupabaseSession): AuthSession | null {
  return mapSupabaseSession(session)
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
      return data.session ? toAuthSession(data.session) : null
    },

    async getCurrentUser() {
      const { data } = await supabase.auth.getSession()
      return data.session ? (toAuthSession(data.session)?.user ?? null) : null
    },

    async getAccessToken() {
      const session = await this.refreshSession()
      return session?.accessToken ?? null
    },

    async refreshSession() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return null
      const skewMs = 60_000
      const expiresAt = (data.session.expires_at ?? 0) * 1000
      if (expiresAt > Date.now() + skewMs) {
        return toAuthSession(data.session)
      }
      const { data: refreshed, error } = await supabase.auth.refreshSession()
      if (error || !refreshed.session) return null
      return toAuthSession(refreshed.session)
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
    },

    onAuthStateChange(cb) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        cb(session ? toAuthSession(session) : null)
      })
      return () => data.subscription.unsubscribe()
    }
  }
}
