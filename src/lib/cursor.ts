import type { FormEvent } from 'react'

export function placeCursorAtEnd(event: FormEvent<HTMLDivElement>): void {
  const sel = window.getSelection()
  if (!sel || sel.anchorOffset > 0) return
  const range = document.createRange()
  range.selectNodeContents(event.target as Node)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}
