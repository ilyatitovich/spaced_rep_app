import CodeMirror, {
  EditorView,
  type Extension,
  type ReactCodeMirrorRef
} from '@uiw/react-codemirror'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { Trash2 } from 'lucide-react'

import { useFontSize } from '@/hooks'
import { canFocusForKeyboard, getLanguageExtension, type CodeLang } from '@/lib'
import type { CodeBlock } from '@/types'

export type CodeBlockEditorHandle = {
  focus: () => void
}

type CodeBlockEditorProps = {
  value: CodeBlock
  isEditable?: boolean
  onChange?: (value: CodeBlock) => void
  onFocus?: () => void
  onRemove?: () => void
}

const LANG_LABEL: Record<CodeLang, string> = {
  ts: 'TypeScript',
  js: 'JavaScript',
  py: 'Python',
  sql: 'SQL',
  sh: 'Bash'
}

const grayEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent'
  },
  '.cm-scroller': {
    backgroundColor: 'transparent'
  },
  '.cm-content': {
    caretColor: 'currentColor',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgb(0 0 0 / 0.08)'
  },
  '.cm-cursor': {
    borderLeftColor: 'currentColor'
  }
})

/** Standalone code snippet editor (language label + CodeMirror). */
const CodeBlockEditor = forwardRef<CodeBlockEditorHandle, CodeBlockEditorProps>(
  function CodeBlockEditor(
    { value, isEditable = false, onChange, onFocus, onRemove },
    ref
  ) {
    const cmRef = useRef<ReactCodeMirrorRef>(null)
    const [code, setCode] = useState(value.code)
    const [lang, setLang] = useState<CodeLang>(value.lang)
    const [extensions, setExtensions] = useState<Extension[]>([grayEditorTheme])
    const fontSize = useFontSize(code)

    useImperativeHandle(ref, () => ({
      focus: () => cmRef.current?.view?.focus()
    }))

    useEffect(() => {
      setCode(value.code)
      setLang(value.lang)
    }, [value.code, value.lang])

    useEffect(() => {
      getLanguageExtension(lang).then(ext => {
        setExtensions([ext, EditorView.lineWrapping, grayEditorTheme])
      })
    }, [lang])

    const emit = (next: CodeBlock) => onChange?.(next)

    return (
      <div className="relative w-full rounded-xl bg-muted px-2 pb-1 pt-6">
        {isEditable && onRemove && (
          <button
            type="button"
            className="absolute top-1.5 left-2 z-10 p-0.5 text-foreground-muted"
            aria-label="Remove code block"
            onPointerDown={e => e.stopPropagation()}
            onClick={onRemove}
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        )}

        <span className="absolute top-1.5 right-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
          {LANG_LABEL[lang] ?? lang}
        </span>

        <CodeMirror
          ref={cmRef}
          className="overflow-hidden rounded-md bg-transparent mt-1"
          value={code}
          height="auto"
          minHeight="48px"
          theme={grayEditorTheme}
          extensions={extensions}
          editable={isEditable}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            tabSize: 2,
            autocompletion: false,
            bracketMatching: true,
            highlightSpecialChars: false
          }}
          onChange={next => {
            setCode(next)
            emit({ code: next, lang })
          }}
          onFocus={() => onFocus?.()}
          onCreateEditor={view => {
            if (isEditable && !value.code && canFocusForKeyboard()) view.focus()
          }}
          style={{
            fontSize,
            lineHeight: '1.4',
            overflow: 'hidden',
            backgroundColor: 'transparent'
          }}
        />
      </div>
    )
  }
)

export default CodeBlockEditor
