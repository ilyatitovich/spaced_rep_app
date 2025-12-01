import { FormEvent } from 'react'

export function placeCursorAtEnd(event: FormEvent<HTMLDivElement>): void {
  const range = document.createRange()
  const sel = window.getSelection()
  if (!sel) return
  range.selectNodeContents(event.target as Node)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}
