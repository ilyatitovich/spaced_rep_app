/** Blur focus and pin window scroll — iOS PWA leaves a residual offset after the keyboard. */
export function resetViewportScroll(): void {
  if (typeof window === 'undefined') return

  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body) {
    active.blur()
  }

  const reset = () => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  reset()
  requestAnimationFrame(reset)
  // Keyboard collapse finishes after the overlay transition (~300ms)
  window.setTimeout(reset, 300)
}
