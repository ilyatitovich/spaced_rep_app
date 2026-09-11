import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject
} from 'react'
import { createPortal } from 'react-dom'
import { useEditorState, type Editor } from '@tiptap/react'
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react'

import { isMobileDevice } from '@/lib'

type TextFormatToolbarProps = {
  visible: boolean
  editor: Editor | null
  /** Desktop: fixed above the card. Mobile: fixed above keyboard. */
  placement: 'card' | 'keyboard'
  /** Card face used to position the desktop toolbar above it. */
  anchorRef?: RefObject<HTMLElement | null>
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onBulletList: () => void
  onNumberedList: () => void
}

function useKeyboardOffset(enabled: boolean): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.visualViewport) {
      return
    }

    const vv = window.visualViewport
    const update = () => {
      const keyboard = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      )
      setOffset(keyboard)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])

  return offset
}

function useAnchorBox(
  enabled: boolean,
  anchorRef?: RefObject<HTMLElement | null>
) {
  const [box, setBox] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!enabled || !anchorRef?.current) {
      setBox(null)
      return
    }

    const el = anchorRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setBox({ top: rect.top, left: rect.left, width: rect.width })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [enabled, anchorRef])

  return box
}

function toolbarBtnClass(active: boolean): string {
  return `p-2 rounded-full ${
    active ? 'bg-primary text-background' : 'text-foreground'
  }`
}

function keepEditorFocus(e: MouseEvent) {
  e.preventDefault()
}

function ListTypeButton({
  menuAbove,
  bulletActive,
  orderedActive,
  onBulletList,
  onNumberedList
}: {
  menuAbove: boolean
  bulletActive: boolean
  orderedActive: boolean
  onBulletList: () => void
  onNumberedList: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const active = bulletActive || orderedActive
  const Icon = orderedActive ? ListOrdered : List

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={toolbarBtnClass(active)}
        aria-label="List"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-pressed={active}
        tabIndex={-1}
        onClick={() => setOpen(v => !v)}
      >
        <Icon className="w-4 h-4" strokeWidth={3} />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute left-1/2 z-50 min-w-[9rem] -translate-x-1/2 rounded-xl border border-border bg-card p-1 shadow-md ${
            menuAbove ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={bulletActive}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
              bulletActive ? 'bg-primary text-background' : 'hover:bg-muted'
            }`}
            onClick={() => {
              onBulletList()
              setOpen(false)
            }}
          >
            <List className="w-4 h-4 shrink-0" strokeWidth={3} />
            Bulleted
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={orderedActive}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
              orderedActive ? 'bg-primary text-background' : 'hover:bg-muted'
            }`}
            onClick={() => {
              onNumberedList()
              setOpen(false)
            }}
          >
            <ListOrdered className="w-4 h-4 shrink-0" strokeWidth={3} />
            Numbered
          </button>
        </div>
      )}
    </div>
  )
}

export default function TextFormatToolbar({
  visible,
  editor,
  placement,
  anchorRef,
  onBold,
  onItalic,
  onUnderline,
  onBulletList,
  onNumberedList
}: TextFormatToolbarProps) {
  const keyboardOffset = useKeyboardOffset(placement === 'keyboard' && visible)
  const anchorBox = useAnchorBox(placement === 'card' && visible, anchorRef)
  const rangeRef = useRef<{ from: number; to: number } | null>(null)

  const rememberRange = () => {
    const sel = editor?.state.selection
    if (!sel || sel.empty) return
    rangeRef.current = { from: sel.from, to: sel.to }
  }

  const apply = (fn: () => void) => {
    const range = rangeRef.current
    if (editor && range) editor.commands.setTextSelection(range)
    fn()
    const restore = () => {
      if (!editor || !range || range.from === range.to) return
      editor.commands.setTextSelection(range)
      rangeRef.current = range
    }
    restore()
    requestAnimationFrame(restore)
  }

  const marks = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed?.isActive('bold') ?? false,
      italic: ed?.isActive('italic') ?? false,
      underline: ed?.isActive('underline') ?? false,
      bulletList: ed?.isActive('bulletList') ?? false,
      orderedList: ed?.isActive('orderedList') ?? false
    })
  }) ?? {
    bold: false,
    italic: false,
    underline: false,
    bulletList: false,
    orderedList: false
  }

  if (!visible || typeof document === 'undefined') return null

  const buttons = (
    <>
      <button
        type="button"
        tabIndex={-1}
        className={toolbarBtnClass(marks.bold)}
        aria-label="Bold"
        aria-pressed={marks.bold}
        onClick={() => apply(onBold)}
      >
        <Bold className="w-4 h-4" strokeWidth={3} />
      </button>
      <button
        type="button"
        tabIndex={-1}
        className={toolbarBtnClass(marks.italic)}
        aria-label="Italic"
        aria-pressed={marks.italic}
        onClick={() => apply(onItalic)}
      >
        <Italic className="w-4 h-4" strokeWidth={3} />
      </button>
      <button
        type="button"
        tabIndex={-1}
        className={toolbarBtnClass(marks.underline)}
        aria-label="Underline"
        aria-pressed={marks.underline}
        onClick={() => apply(onUnderline)}
      >
        <Underline className="w-4 h-4" strokeWidth={3} />
      </button>
      <ListTypeButton
        menuAbove={placement === 'keyboard'}
        bulletActive={marks.bulletList}
        orderedActive={marks.orderedList}
        onBulletList={() => apply(onBulletList)}
        onNumberedList={() => apply(onNumberedList)}
      />
    </>
  )

  const rootProps = {
    'data-text-toolbar': true,
    onPointerDownCapture: rememberRange,
    onMouseDownCapture: keepEditorFocus
  }

  if (placement === 'keyboard') {
    return createPortal(
      <div
        {...rootProps}
        className="fixed left-0 right-0 z-50 flex justify-center gap-1 border-t border-border bg-card px-2 py-1 shadow-[0_-4px_12px_rgb(0_0_0/0.08)] select-none"
        style={{ bottom: keyboardOffset }}
      >
        {buttons}
      </div>,
      document.body
    )
  }

  if (!anchorBox) return null

  const toolbarHeight = 40
  const gap = 8

  return createPortal(
    <div
      {...rootProps}
      className="fixed z-50 flex justify-center pointer-events-none select-none"
      style={{
        top: Math.max(8, anchorBox.top - toolbarHeight - gap),
        left: anchorBox.left,
        width: anchorBox.width
      }}
    >
      <div className="pointer-events-auto flex gap-0.5 rounded-full border border-border bg-card px-1 shadow-sm">
        {buttons}
      </div>
    </div>,
    document.body
  )
}

export function getToolbarPlacement(): 'card' | 'keyboard' {
  return isMobileDevice() ? 'keyboard' : 'card'
}
