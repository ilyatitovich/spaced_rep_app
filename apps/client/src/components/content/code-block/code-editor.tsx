import CodeMirror, { EditorView, type Extension } from '@uiw/react-codemirror'
import { FocusEventHandler, useEffect, useState } from 'react'

import LangSelect from '../../ui/lang-select'
import { useFontSize } from '@/hooks/use-font-size'
import { getLanguageExtension, type CodeLang } from '@/lib/code-lang'
import { placeCursorAtEnd } from '@/lib/cursor'
import { canFocusForKeyboard } from '@/lib/pwa'
import type { CodeBlock } from '@/types'

type CodeEditorProps = {
  onChange?: (value: CodeBlock) => void
  onFocus?: FocusEventHandler<HTMLDivElement>
  initialValue: CodeBlock
  isEditable?: boolean
}

export default function CodeEditor({
  initialValue,
  isEditable,
  onFocus,
  onChange
}: CodeEditorProps) {
  const [code, setCode] = useState(initialValue.code)
  const [lang, setLang] = useState<CodeLang>(initialValue.lang)
  const [extensions, setExtensions] = useState<Extension[]>([])

  const fontSize = useFontSize(code)

  useEffect(() => {
    getLanguageExtension(lang).then(ext => {
      setExtensions([ext, EditorView.lineWrapping])
    })
  }, [lang])

  const handleCodeChange = (next: string): void => {
    setCode(next)
    onChange?.({ code: next, lang })
  }

  const handleLangChange = (next: CodeLang): void => {
    setLang(next)
    onChange?.({ code, lang: next })
  }

  return (
    <div className="h-full w-full pt-2 overflow-y-auto">
      {isEditable && (
        <div className="flex justify-center">
          <LangSelect lang={lang} onChange={handleLangChange} />
        </div>
      )}
      <CodeMirror
        className="mt-2 border border-border"
        value={code}
        height="auto"
        minHeight="50px"
        theme="light"
        extensions={extensions}
        editable={!!isEditable}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          tabSize: 2,
          autocompletion: false,
          bracketMatching: true,
          highlightSpecialChars: false
        }}
        onChange={handleCodeChange}
        onFocus={e => {
          onFocus?.(e)
          placeCursorAtEnd(e)
        }}
        onCreateEditor={view => {
          if (isEditable && !initialValue.code && canFocusForKeyboard()) {
            view.focus()
          }
        }}
        style={{
          fontSize,
          lineHeight: '1.4',
          overflow: 'hidden'
        }}
      />
    </div>
  )
}
