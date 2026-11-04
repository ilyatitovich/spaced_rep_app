/** Host suffixes for browser push services (FCM, Mozilla, Apple, WNS). */
export const PUSH_ENDPOINT_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
  'push.apple.com',
  'notify.windows.com'
] as const

const IPV4_LITERAL = /^\d{1,3}(?:\.\d{1,3}){3}$/

/** Push services use hostnames — block localhost and any raw IP (SSRF). */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1' || host === '[::1]') return true
  return IPV4_LITERAL.test(host)
}

export function isPushEndpointAllowed(endpoint: string): boolean {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const lower = url.hostname.toLowerCase()
  if (isBlockedHost(lower)) return false
  return PUSH_ENDPOINT_HOST_SUFFIXES.some(
    suffix => lower === suffix || lower.endsWith(`.${suffix}`)
  )
}
