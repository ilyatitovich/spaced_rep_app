import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Matches supabase-js default: `sb-{project-ref}-auth-token`. */
export function getSupabaseAuthStorageKey(
  url = supabaseUrl || 'http://localhost:54321'
): string {
  const hostname = new URL(url).hostname
  const ref = hostname.split('.')[0] || 'localhost'
  return `sb-${ref}-auth-token`
}

// Placeholders so createClient never throws when unused (provider=custom / local-only).
// Real calls go through the supabase AuthPort / SyncPort when VITE_BACKEND_PROVIDER=supabase.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)
