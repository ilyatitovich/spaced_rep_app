import CodeMirror, { EditorView, type Extension } from '@uiw/react-codemirror'
import { FocusEventHandler, useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import { getLanguageExtension, placeCursorAtEnd, type CodeLang } from '@/lib'
import type { CodeBlock } from '@/types'

type CodeEditorProps = {
  onChange?: (value: CodeBlock) => void
  onFocus?: FocusEventHandler<HTMLDivElement>
  initialValue?: CodeBlock
  isEditable?: boolean
}

export default function CodeEditor({
  initialValue,
  isEditable,
  onFocus,
  onChange
}: CodeEditorProps) {
  const [lang, setLang] = useState<CodeLang>('sh')
  const [extensions, setExtensions] = useState<Extension[]>([])

  useEffect(() => {
    if (initialValue?.lang) {
      setLang(initialValue.lang)
    }
  }, [initialValue?.lang])

  useEffect(() => {
    getLanguageExtension(lang).then(ext => {
      setExtensions([ext, EditorView.lineWrapping])
    })
  }, [lang])

  const debouncedOnChange = useDebouncedCallback((code: string) => {
    onChange?.({ code, lang })
  }, 300)

  return (
    <div className="h-full w-full pt-4 overflow-y-auto">
      {isEditable && (
        <div className="flex justify-center">
          <select
            value={lang}
            onChange={e => setLang(e.target.value as CodeLang)}
            className="text-sm outline-0 border border-gray-300"
          >
            <option value="ts">TypeScript</option>
            <option value="py">Python</option>
            <option value="sql">SQL</option>
            <option value="sh">Bash</option>
          </select>
        </div>
      )}
      <CodeMirror
        className="mt-4 border border-gray-200"
        value={initialValue?.code ?? ''}
        height="auto"
        minHeight="50px"
        theme="light"
        extensions={extensions}
        editable={!!isEditable}
        basicSetup={{
          lineNumbers: false, // Avoids horizontal scrolling on mobile
          foldGutter: false,
          highlightActiveLine: false,
          tabSize: 2,
          autocompletion: false, // Avoids opening mobile keyboard popups
          bracketMatching: true,
          highlightSpecialChars: false
        }}
        onChange={v => debouncedOnChange(v)}
        onFocus={e => {
          onFocus?.(e)
          placeCursorAtEnd(e)
        }}
        style={{
          fontSize: '12px', // Prevents iOS zooming on input focus
          lineHeight: '1.4',
          overflow: 'hidden'
        }}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={isEditable && !initialValue?.code}
      />
    </div>
  )
}
