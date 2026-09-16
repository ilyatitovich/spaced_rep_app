import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditorState, type Editor } from '@tiptap/react'
import { Bold, Italic, List, ListOrdered, Sigma, Underline } from 'lucide-react'

const KEYBOARD_GAP_PX = 8

function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}

function visualViewportBottom(): number {
  const vv = window.visualViewport
  if (!vv) return window.innerHeight
  return vv.offsetTop + vv.height
}

function useKeyboardDockTop(enabled: boolean) {
  const [top, setTop] = useState(visualViewportBottom)

  useEffect(() => {
    if (!enabled) return
    const vv = window.visualViewport
    const update = () => setTop(visualViewportBottom())
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
    }
  }, [enabled])

  return top
}

type TextFormatToolbarProps = {
  visible: boolean
  editor: Editor | null
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onBulletList: () => void
  onNumberedList: () => void
}

export function isToolbarTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-text-toolbar]')
}

function toolbarBtnClass(active: boolean): string {
  return `p-2 rounded-full ${
    active ? 'bg-primary text-background' : 'text-foreground'
  }`
}

function keepEditorFocus(e: { preventDefault: () => void }) {
  e.preventDefault()
}

function ListTypeButton({
  bulletActive,
  orderedActive,
  onBulletList,
  onNumberedList,
  openUp
}: {
  bulletActive: boolean
  orderedActive: boolean
  onBulletList: () => void
  onNumberedList: () => void
  openUp: boolean
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
          className={`absolute left-1/2 z-50 min-w-36 -translate-x-1/2 rounded-xl border border-border bg-card p-1 shadow-md ${
            openUp ? 'bottom-full mb-1' : 'top-full mt-1'
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
  onBold,
  onItalic,
  onUnderline,
  onBulletList,
  onNumberedList
}: TextFormatToolbarProps) {
  const rangeRef = useRef<{ from: number; to: number } | null>(null)
  const isTouch = isTouchDevice()
  const dockTop = useKeyboardDockTop(visible && isTouch)

  const rememberRange = () => {
    const sel = editor?.state.selection
    if (!sel || sel.empty) {
      rangeRef.current = null
      return
    }
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

  const insertMath = () => {
    if (!editor) return
    const range = rangeRef.current
    if (range) editor.commands.setTextSelection(range)

    const { from, to, empty } = editor.state.selection
    if (empty) {
      editor.commands.insertContent('\\(\\)')
      editor.commands.setTextSelection(from + 2)
      rangeRef.current = null
      return
    }

    const text = editor.state.doc.textBetween(from, to)
    const wrapped = `\\(${text}\\)`
    editor.commands.insertContent(wrapped)
    const next = { from, to: from + wrapped.length }
    editor.commands.setTextSelection(next)
    rangeRef.current = next
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

  if (!visible) return null

  const toolbar = (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      data-text-toolbar
      className={
        isTouch
          ? 'fixed left-1/2 z-100 -translate-x-1/2 -translate-y-full select-none'
          : 'absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 select-none'
      }
      style={isTouch ? { top: dockTop - KEYBOARD_GAP_PX } : undefined}
      onPointerDownCapture={e => {
        keepEditorFocus(e)
        rememberRange()
      }}
      onMouseDownCapture={keepEditorFocus}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex gap-0.5 rounded-full border border-border bg-card px-1 shadow-sm">
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
          bulletActive={marks.bulletList}
          orderedActive={marks.orderedList}
          openUp={isTouch}
          onBulletList={() => apply(onBulletList)}
          onNumberedList={() => apply(onNumberedList)}
        />
        <button
          type="button"
          tabIndex={-1}
          className={toolbarBtnClass(false)}
          aria-label="Math"
          onClick={insertMath}
        >
          <Sigma className="w-4 h-4" strokeWidth={3} />
        </button>
      </div>
    </div>
  )

  return isTouch ? createPortal(toolbar, document.body) : toolbar
}
