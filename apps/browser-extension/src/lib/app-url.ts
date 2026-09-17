const APP_ORIGIN = new URL(
  import.meta.env.WXT_PUBLIC_APP_URL ?? 'http://localhost:5173'
).origin

export function isAppUrl(url?: string): boolean {
  if (!url) return false
  try {
    return new URL(url).origin === APP_ORIGIN
  } catch {
    return false
  }
}
