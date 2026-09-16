import {
  createCustomAuthAdapter,
  createCustomSettingsAdapter,
  createCustomSyncAdapter
} from './custom'
import type { BackendPorts } from './types'

function createPorts(): BackendPorts {
  if (!import.meta.env.VITE_API_URL?.trim()) {
    throw new Error('VITE_API_URL is required when the backend is enabled.')
  }
  return {
    auth: createCustomAuthAdapter(),
    sync: createCustomSyncAdapter(),
    settings: createCustomSettingsAdapter()
  }
}

/** Active backend ports, or null when running local-only (no VITE_API_URL). */
export const backend: BackendPorts | null = import.meta.env.VITE_API_URL?.trim()
  ? createPorts()
  : null

export function isBackendConfigured(): boolean {
  return backend !== null
}

export const auth = backend?.auth ?? null
export const sync = backend?.sync ?? null
export const settings = backend?.settings ?? null

export type { AuthPort, SyncPort, SettingsPort, AuthCapabilities } from './types'
