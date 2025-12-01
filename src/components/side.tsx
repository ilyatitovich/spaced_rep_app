import type { FocusEventHandler, FormEvent, RefObject } from 'react'
import { useCallback, useEffect, useState } from 'react'

import ImageUploader from './image-uploader'
import { LONGTEXT_THRESHOLD, placeCursorAtEnd } from '@/lib'
import type { CardSideData, SideContentType, SideName } from '@/types'

type SideProps = {
  data: CardSideData
  contentType?: SideContentType
  isEditable?: boolean
  handleFocus?: FocusEventHandler<HTMLDivElement>
  handleBlur?: FocusEventHandler<HTMLDivElement>
  innerRef?: RefObject<HTMLDivElement>
  onChange?: (value: string | Blob, side: SideName) => void
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

  const handleInput = useCallback(
    (e: FormEvent<HTMLDivElement>) => {
      setIsLongText(e.currentTarget.innerText.length > LONGTEXT_THRESHOLD)
      onChange?.(e.currentTarget.innerText, data.side)
    },
    [data.side, onChange]
  )

  const handleChangeImage = useCallback(
    (file: Blob) => {
      onChange?.(file, data.side)
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

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={`absolute w-full h-full p-4 backface-hidden ${isLongText ? 'overflow-y-auto scrollbar-hidden' : 'flex justify-center items-center'} border-black border-6 rounded-4xl bg-white ${data.side === 'back' ? 'rotate-y-180' : ''}`.trim()}
      onClick={handleClick}
    >
      {(contentType && contentType === 'image') ||
      (data.type === 'image' && data.content instanceof Blob) ? (
        isEditable ? (
          <ImageUploader
            onChange={handleChangeImage}
            initialPreview={
              data.content instanceof Blob
                ? URL.createObjectURL(data.content as Blob)
                : ''
            }
          />
        ) : (
          <img
            src={URL.createObjectURL(data.content as Blob)}
            alt={`${data.side} side`}
            className="max-w-full max-h-full object-contain"
          />
        )
      ) : (
        <div
          ref={innerRef}
          className={`w-full outline-none whitespace-pre-wrap break-words ${isLongText ? 'text-left text-2xl' : 'text-center text-3xl font-bold font-card leading-12'}`}
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
          onInput={e => {
            handleInput(e)
            placeCursorAtEnd(e)
          }}
        >
          {typeof data.content === 'string' ? data.content : ''}
        </div>
      )}
    </div>
  )
}
