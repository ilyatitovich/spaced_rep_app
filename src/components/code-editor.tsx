import CodeMirror, { EditorView, type Extension } from '@uiw/react-codemirror'
import { FocusEventHandler, useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import { LangSelect } from './ui'
import {
  getFontSize,
  getLanguageExtension,
  placeCursorAtEnd,
  type CodeLang
} from '@/lib'
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
  const [code, setCode] = useState('')
  const [lang, setLang] = useState<CodeLang>('sh')
  const [extensions, setExtensions] = useState<Extension[]>([])

  useEffect(() => {
    if (initialValue) {
      setCode(initialValue.code)
      setLang(initialValue.lang)
    }
  }, [initialValue])

  useEffect(() => {
    getLanguageExtension(lang).then(ext => {
      setExtensions([ext, EditorView.lineWrapping])
    })
  }, [lang])

  const debouncedOnChange = useDebouncedCallback((code: string) => {
    setCode(code)
    onChange?.({ code, lang })
  }, 300)

  const handleLangChange = (lang: CodeLang): void => {
    setLang(lang)
    onChange?.({ code, lang })
  }

  return (
    <div className="h-full w-full pt-4 overflow-y-auto scrollbar-hidden">
      {isEditable && (
        <div className="flex justify-center">
          <LangSelect lang={lang} onChange={handleLangChange} />
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
          fontSize: getFontSize(code), // Prevents iOS zooming on input focus
          lineHeight: '1.4',
          overflow: 'hidden'
        }}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={isEditable && !initialValue?.code}
      />
    </div>
  )
}
