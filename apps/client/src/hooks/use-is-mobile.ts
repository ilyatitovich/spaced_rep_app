import { useSyncExternalStore } from 'react'

export const MOBILE_BREAKPOINT = 640 // px

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true) // SSR fallback: assume mobile
}
