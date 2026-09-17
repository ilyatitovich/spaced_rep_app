import { useReduceMotion } from './use-reduce-motion'
import { useIsTouch } from './use-is-touch'
import { useIsMobile } from './use-is-mobile'

export function useShouldAnimate(): boolean {
  const isTouch = useIsTouch()
  const reduceMotion = useReduceMotion()
  const isMobile = useIsMobile()
  return isTouch && !reduceMotion && isMobile
}
