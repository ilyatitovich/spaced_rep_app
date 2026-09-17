import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
