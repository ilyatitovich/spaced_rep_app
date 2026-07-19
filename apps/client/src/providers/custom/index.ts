import {
  browserSupportsWebAuthn,
  startAuthentication
} from '@simplewebauthn/browser'
import {
  ensureFreshSession,
  isGoogleAuthConfigured,
  logoutAuthSession,
  passkeyLoginOptions,
  passkeyLoginVerify,
  requestEmailOtp as requestEmailOtpApi,
  verifyEmailOtp as verifyEmailOtpApi,
  fetchSettings,
  fetchSubscription,
  patchSettingsLearning,
  patchSettingsNotifications,
  patchSettingsPreferences
} from '@/lib/api'
import {
  clearAuthSession,
  getAuthSession,
  setPkcePending,
  type AuthSession
} from '@/lib/auth-storage'
import {
  buildGoogleAuthorizeUrl,
  createPkcePair,
  googleRedirectUri
} from '@/lib/pkce'
import {
  httpBootstrap,
  httpPull,
  httpPushBatch
} from '@/services/sync-http.client'
import { syncWsManager } from '@/services/sync-ws.manager'
import type {
  AuthPort,
  SettingsPort,
  SyncPort,
  SyncRealtimeHandlers
} from '../types'

function isWebAuthnAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'NotAllowedError' || error.name === 'AbortError')
  )
}

export function createCustomAuthAdapter(): AuthPort {
  const listeners = new Set<(session: AuthSession | null) => void>()

  function emit(session: AuthSession | null) {
    for (const cb of listeners) cb(session)
  }

  return {
    capabilities: {
      google: isGoogleAuthConfigured(),
      passkey: true,
      emailOtp: true
    },

    async getSession() {
      return ensureFreshSession()
    },

    async getCurrentUser() {
      const session = await ensureFreshSession()
      return session?.user ?? null
    },

    async getAccessToken() {
      const session = await ensureFreshSession()
      return session?.accessToken ?? getAuthSession()?.accessToken ?? null
    },

    async refreshSession() {
      return ensureFreshSession()
    },

    async loginWithGoogle() {
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

    async loginWithPasskey() {
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
      const session = await passkeyLoginVerify({ credential })
      emit(session)
      return
    },

    async requestEmailOtp(email, turnstileToken) {
      await requestEmailOtpApi({ email, turnstileToken })
    },

    async verifyEmailOtp(email, token) {
      const session = await verifyEmailOtpApi({ email, code: token })
      emit(session)
      return session
    },

    async logout() {
      const accessToken = getAuthSession()?.accessToken
      if (accessToken) {
        await logoutAuthSession(accessToken)
      } else {
        clearAuthSession()
      }
      emit(null)
    },

    onAuthStateChange(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    }
  }
}

export function createCustomSyncAdapter(): SyncPort {
  return {
    push: httpPushBatch,
    pull: httpPull,
    bootstrap: httpBootstrap,

    connectRealtime(handlers: SyncRealtimeHandlers) {
      syncWsManager.setListeners({
        onDelta: handlers.onDelta,
        onConflict: handlers.onConflict,
        onStateChange: state => {
          if (state === 'active') handlers.onStateChange?.('active')
          else if (state === 'disconnected')
            handlers.onStateChange?.('disconnected')
          else if (state === 'connecting' || state === 'authenticating')
            handlers.onStateChange?.('connecting')
        },
        onTokenExpired: handlers.onTokenExpired
      })

      return {
        connect: input => syncWsManager.connect(input),
        disconnect: () => syncWsManager.disconnect(),
        isActive: () => syncWsManager.isActive(),
        pushBatch: mutations => syncWsManager.pushBatch(mutations),
        updateResume: (lastPulledAt, pendingOpCount) =>
          syncWsManager.updateResume(lastPulledAt, pendingOpCount)
      }
    }
  }
}

export function createCustomSettingsAdapter(): SettingsPort {
  async function token(): Promise<string> {
    const session = await ensureFreshSession()
    const accessToken = session?.accessToken ?? getAuthSession()?.accessToken
    if (!accessToken) throw new Error('Not authenticated')
    return accessToken
  }

  return {
    async fetchSettings() {
      return fetchSettings(await token())
    },
    async fetchSubscription() {
      return fetchSubscription(await token())
    },
    async patchPreferences(body) {
      return patchSettingsPreferences(await token(), body)
    },
    async patchLearning(body) {
      return patchSettingsLearning(await token(), body)
    },
    async patchNotifications(body) {
      return patchSettingsNotifications(await token(), body)
    }
  }
}
