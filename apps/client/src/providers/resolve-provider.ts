export type BackendProvider = 'custom' | 'supabase'

/** Resolve active backend from env. Safe to import from lib (no adapter deps). */
export function resolveBackendProvider(): BackendProvider | null {
  const raw = (import.meta.env.VITE_BACKEND_PROVIDER ?? '').trim().toLowerCase()
  if (raw === 'custom' || raw === 'supabase') return raw
  if (raw) {
    throw new Error(
      `Invalid VITE_BACKEND_PROVIDER="${raw}". Expected "custom" or "supabase".`
    )
  }
  if (import.meta.env.VITE_API_URL?.trim()) return 'custom'
  if (
    import.meta.env.VITE_SUPABASE_URL?.trim() &&
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  ) {
    return 'supabase'
  }
  return null
}
