import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { FocusEvent, FocusEventHandler, Ref } from 'react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef
} from 'react'

import { LONGTEXT_THRESHOLD, sanitizeCardHtml } from '@/lib'

export type TextBlockEditorHandle = {
  getHtml: () => string
  focus: () => void
  reset: () => void
  getEditor: () => Editor | null
}

type TextBlockEditorProps = {
  html: string
  isEditable?: boolean
  onFocus?: FocusEventHandler<HTMLElement>
  onBlur?: FocusEventHandler<HTMLElement>
  onLongTextChange?: (isLong: boolean) => void
  /** Backspace at start of an empty doc — parent may remove this block. */
  onBackspaceEmpty?: () => void
}

const extensions = [
  StarterKit.configure({
    codeBlock: false,
    code: false,
    heading: false,
    blockquote: false,
    horizontalRule: false,
    strike: false,
    link: false,
    // Trailing empty paragraph steals caret after list toggle.
    trailingNode: false
  })
]

function ensureDefaultBold(editor: Editor) {
  if (editor.getText().trim()) return
  if (editor.isActive('bold')) return
  editor.commands.setMark('bold')
}

function TextBlockEditorInner(
  {
    html,
    isEditable = false,
    onFocus,
    onBlur,
    onLongTextChange,
    onBackspaceEmpty
  }: TextBlockEditorProps,
  ref: Ref<TextBlockEditorHandle>
) {
  const onFocusRef = useRef(onFocus)
  const onBlurRef = useRef(onBlur)
  const onLongTextChangeRef = useRef(onLongTextChange)
  const onBackspaceEmptyRef = useRef(onBackspaceEmpty)
  onFocusRef.current = onFocus
  onBlurRef.current = onBlur
  onLongTextChangeRef.current = onLongTextChange
  onBackspaceEmptyRef.current = onBackspaceEmpty

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: html || '<p></p>',
    editable: isEditable,
    editorProps: {
      attributes: {
        class:
          'w-full outline-none wrap-break-word card-rich-text focus:outline-none min-h-[1.5em]'
      },
      handleDOMEvents: {
        focus: (_view, event) => {
          onFocusRef.current?.(event as unknown as FocusEvent<HTMLElement>)
          return false
        },
        blur: (_view, event) => {
          onBlurRef.current?.(event as unknown as FocusEvent<HTMLElement>)
          return false
        }
      },
      handleKeyDown: (view, event) => {
        if (event.key !== 'Backspace') return false
        if (view.state.doc.textContent.length > 0) return false
        if (!view.state.selection.empty) return false
        onBackspaceEmptyRef.current?.()
        return true
      }
    },
    onCreate: ({ editor: ed }) => {
      ensureDefaultBold(ed)
    },
    onUpdate: ({ editor: ed }) => {
      onLongTextChangeRef.current?.(
        ed.getText().length > LONGTEXT_THRESHOLD
      )
    }
  })

  useImperativeHandle(ref, () => ({
    getHtml: () => sanitizeCardHtml(editor?.getHTML() ?? ''),
    focus: () => {
      editor?.commands.focus('end', { scrollIntoView: false })
    },
    reset: () => {
      editor?.commands.setContent('<p></p>', { emitUpdate: false })
      if (editor) ensureDefaultBold(editor)
    },
    getEditor: () => editor
  }))

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!!isEditable)
  }, [editor, isEditable])

  // External html only (load/reset). Never while focused — typing lives in TipTap.
  useEffect(() => {
    if (!editor) return
    const incoming = sanitizeCardHtml(html || '<p></p>') || '<p></p>'
    if (sanitizeCardHtml(editor.getHTML()) === incoming) return
    if (editor.isFocused) return
    editor.commands.setContent(incoming || '<p></p>', { emitUpdate: false })
  }, [editor, html])

  const isLong =
    useEditorState({
      editor,
      selector: ({ editor: ed }) =>
        (ed?.getText().length ?? 0) > LONGTEXT_THRESHOLD
    }) ?? false

  if (!editor) return null

  return (
    <EditorContent
      editor={editor}
      className={`w-full ${
        isLong
          ? 'is-long text-left text-lg [&_.ProseMirror]:text-left'
          : 'text-center text-3xl font-card leading-10 [&_.ProseMirror]:text-center [&_.ProseMirror]:font-card'
      }`}
    />
  )
}

export default forwardRef(TextBlockEditorInner)
