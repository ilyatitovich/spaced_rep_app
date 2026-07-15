import { MOBILE_BREAKPOINT } from '@/hooks'

const POPUP_WIDTH = MOBILE_BREAKPOINT - 20
const POPUP_HEIGHT = 860

export function openNarrowWindow(): void {
  const left = Math.max(0, (screen.width - POPUP_WIDTH) / 2)
  const top = Math.max(0, (screen.height - POPUP_HEIGHT) / 2)

  window.open(
    window.location.href,
    '_blank',
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`
  )
}
