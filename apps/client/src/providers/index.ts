import {
  createCustomAuthAdapter,
  createCustomSettingsAdapter,
  createCustomSyncAdapter
} from './custom'
import { resolveBackendProvider } from './resolve-provider'
import { createSupabaseAuthAdapter } from './supabase/auth'
import { createSupabaseSettingsAdapter } from './supabase'
import { createSupabaseSyncAdapter } from './supabase/sync'
import type { BackendPorts, BackendProvider } from './types'

function assertCustomEnv(): void {
  if (!import.meta.env.VITE_API_URL?.trim()) {
    throw new Error(
      'VITE_BACKEND_PROVIDER=custom requires VITE_API_URL to be set.'
    )
  }
}

function assertSupabaseEnv(): void {
  if (
    !import.meta.env.VITE_SUPABASE_URL?.trim() ||
    !import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  ) {
    throw new Error(
      'VITE_BACKEND_PROVIDER=supabase requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    )
  }
}

function createPorts(provider: BackendProvider): BackendPorts {
  if (provider === 'custom') {
    assertCustomEnv()
    return {
      provider,
      auth: createCustomAuthAdapter(),
      sync: createCustomSyncAdapter(),
      settings: createCustomSettingsAdapter()
    }
  }

  assertSupabaseEnv()
  const auth = createSupabaseAuthAdapter()
  return {
    provider,
    auth,
    sync: createSupabaseSyncAdapter(auth),
    settings: createSupabaseSettingsAdapter(auth)
  }
}

const resolvedProvider = resolveBackendProvider()

/** Active backend ports, or null when running local-only (no provider configured). */
export const backend: BackendPorts | null = resolvedProvider
  ? createPorts(resolvedProvider)
  : null

export function getBackendProvider(): BackendProvider | null {
  return resolvedProvider
}

export function isBackendConfigured(): boolean {
  return backend !== null
}

export const auth = backend?.auth ?? null
export const sync = backend?.sync ?? null
export const settings = backend?.settings ?? null

export type { AuthPort, SyncPort, SettingsPort, BackendProvider, AuthCapabilities } from './types'
