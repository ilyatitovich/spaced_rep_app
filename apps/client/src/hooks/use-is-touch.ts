import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia('(pointer: coarse)')
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}

export function useIsTouch(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false) // SSR fallback: assume not touch
}
