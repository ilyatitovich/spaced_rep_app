import type { FocusEventHandler, FormEvent, ReactNode, RefObject } from 'react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

import ImageUploader from './image-uploader'
import { Spinner } from './ui'
import {
  isRecord,
  LONGTEXT_THRESHOLD,
  placeCursorAtEnd,
  recordToBlob
} from '@/lib'
import type {
  CardSideData,
  CodeBlock,
  ImageDBRecord,
  SideContent,
  SideContentType,
  SideName
} from '@/types'

const CodeEditor = lazy(() => import('./code-editor'))

type SideProps = {
  data: CardSideData
  contentType?: SideContentType
  isEditable?: boolean
  handleFocus?: FocusEventHandler<HTMLDivElement>
  handleBlur?: FocusEventHandler<HTMLDivElement>
  innerRef: RefObject<HTMLDivElement>
  onChange?: (value: SideContent, side: SideName) => void
}

export default function Side({
  data,
  contentType,
  isEditable,
  handleFocus,
  handleBlur,
  onChange,
  innerRef
}: SideProps) {
  const [isLongText, setIsLongText] = useState(false)

  useEffect(() => {
    if (data.type === 'text' && typeof data.content === 'string') {
      setIsLongText(data.content.length > LONGTEXT_THRESHOLD)
    }
  }, [data.content, data.type])

  const handleInput = useCallback((e: FormEvent<HTMLDivElement>) => {
    setIsLongText(e.currentTarget.innerText.length > LONGTEXT_THRESHOLD)
  }, [])

  const handleChangeImage = useCallback(
    (file: ImageDBRecord) => {
      onChange?.(file, data.side)
    },
    [data.side, onChange]
  )

  const handleChangeCode = useCallback(
    (value: CodeBlock) => {
      onChange?.(value, data.side)
    },
    [data.side, onChange]
  )

  const handleClick = useCallback(() => {
    if (
      document.activeElement !== innerRef?.current &&
      innerRef?.current &&
      isEditable
    ) {
      innerRef.current.focus()
    }
  }, [innerRef, isEditable])

  let mode: ReactNode | null = null

  if ((contentType && contentType === 'code') || data.type === 'code') {
    mode = (
      <Suspense fallback={<Spinner />}>
        <CodeEditor
          onChange={handleChangeCode}
          onFocus={handleFocus}
          initialValue={data.content as CodeBlock}
          isEditable={isEditable}
        />
      </Suspense>
    )
  }

  if (
    (contentType && contentType === 'image') ||
    (data.type === 'image' && isRecord(data.content))
  ) {
    mode = isEditable ? (
      <ImageUploader
        onChange={handleChangeImage}
        initialPreview={
          isRecord(data.content)
            ? URL.createObjectURL(recordToBlob(data.content))
            : ''
        }
      />
    ) : (
      <img
        src={URL.createObjectURL(recordToBlob(data.content as ImageDBRecord))}
        alt={`${data.side} side`}
        className="max-w-full max-h-full object-contain"
      />
    )
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={`absolute w-full h-full p-4 backface-hidden ${isLongText ? 'overflow-y-auto scrollbar-hidden' : 'flex justify-center items-center'} border-black border-6 rounded-4xl bg-white ${data.side === 'back' ? 'rotate-y-180' : ''}`.trim()}
      onClick={handleClick}
    >
      {mode ? (
        mode
      ) : (
        <div
          ref={innerRef}
          className={`w-full outline-none whitespace-pre-wrap break-words ${isLongText ? 'text-left text-lg' : 'text-center text-3xl font-bold font-card leading-10'}`}
          contentEditable={isEditable}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          tabIndex={0}
          onFocus={e => {
            handleFocus?.(e)
            placeCursorAtEnd(e)
          }}
          onBlur={handleBlur}
          onInput={handleInput}
        >
          {typeof data.content === 'string' ? data.content : ''}
        </div>
      )}
    </div>
  )
}
