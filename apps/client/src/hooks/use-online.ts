import { useSyncExternalStore, useEffect, useRef, useState } from 'react'

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getSnapshot(): boolean {
  return navigator.onLine
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}

// ---------------------------------------------------------------------------
// useOnlineVerified — useOnline, plus periodic real-reachability checks.
//
// When the browser reports "online", periodically pings a lightweight
// same-origin URL (HEAD request, no-store) to confirm actual connectivity.
// Immediately flips to false the moment the browser reports "offline" —
// no need to wait on a ping for that direction.
//
// Guards against overlapping requests (inFlight ref) and cleans up properly
// on unmount or when dependencies change (cancelled flag + abort on timeout).
// ---------------------------------------------------------------------------

export type UseOnlineVerifiedOptions = {
  /** Same-origin URL to ping. Cross-origin will hit CORS restrictions. */
  pingUrl?: string
  /** Time between verification checks while browser reports online, ms. */
  interval?: number
  /** Abort a single check if it takes longer than this, ms. */
  timeout?: number
}

export function useOnlineVerified({
  pingUrl = '/health',
  interval = 30_000,
  timeout = 5_000
}: UseOnlineVerifiedOptions = {}): boolean {
  const browserOnline = useOnline()
  const [verifiedOnline, setVerifiedOnline] = useState(browserOnline)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!browserOnline) {
      setVerifiedOnline(false)
      return
    }

    let cancelled = false

    const check = async () => {
      if (inFlight.current) return
      inFlight.current = true

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      try {
        const apiUrl = import.meta.env.VITE_API_URL
        if (!apiUrl) {
          if (!cancelled) setVerifiedOnline(browserOnline)
          return
        }
        await fetch(`${apiUrl}${pingUrl}`, {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal
        })
        if (!cancelled) setVerifiedOnline(true)
      } catch {
        if (!cancelled) setVerifiedOnline(false)
      } finally {
        clearTimeout(timer)
        inFlight.current = false
      }
    }

    check()
    const id = setInterval(check, interval)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [browserOnline, pingUrl, interval, timeout])

  return verifiedOnline
}
