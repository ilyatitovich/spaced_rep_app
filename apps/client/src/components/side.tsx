import type { ChangeEvent, FocusEvent, FocusEventHandler, Ref } from 'react'
import type { CardSideData, SideBlock, SideName } from '@/types'
import type { Editor } from '@tiptap/react'
import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'

import ImageUploader from './image-uploader'
import MediaToolbar from './media-toolbar'
import ObjectUrl from './object-url'
import TextBlockEditor, {
  type TextBlockEditorHandle
} from './text-block-editor'
import TextFormatToolbar, { isToolbarTarget } from './text-format-toolbar'
import { Spinner } from './ui'
import { LONGTEXT_THRESHOLD, sanitizeCardHtml } from '@/lib'

const CodeBlockEditor = lazy(() => import('./code-block-editor'))

function bindOverflowScroll(el: HTMLElement) {
  const onWheel = (e: WheelEvent) => {
    if (el.scrollHeight <= el.clientHeight) return
    el.scrollTop += e.deltaY
    e.preventDefault()
  }

  el.addEventListener('wheel', onWheel, { passive: false })
  return () => el.removeEventListener('wheel', onWheel)
}

export type SideHandle = {
  getBlocks: () => SideBlock[]
  reset: () => void
  focusFirstText: () => void
  focusLastText: () => void
}

type SideProps = {
  data: CardSideData
  isEditable?: boolean
  isVisible?: boolean
  handleFocus?: FocusEventHandler<HTMLElement>
  handleBlur?: FocusEventHandler<HTMLElement>
  onChange?: (blocks: SideBlock[], side: SideName) => void
}

export default forwardRef(function Side(
  { data, isEditable, isVisible = true, handleFocus, handleBlur, onChange }: SideProps,
  ref: Ref<SideHandle>
) {
  const [isTextFocused, setIsTextFocused] = useState(false)
  const [focusedTextIndex, setFocusedTextIndex] = useState<number | null>(null)
  const textEditors = useRef<Map<number, TextBlockEditorHandle>>(new Map())
  const focusedTextIndexRef = useRef<number | null>(null)
  const skipBlurRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  focusedTextIndexRef.current = focusedTextIndex

  const readBlocks = useCallback((): SideBlock[] => {
    return data.blocks.map((block, index) => {
      if (block.type !== 'text') return block
      const handle = textEditors.current.get(index)
      return {
        type: 'text' as const,
        html: handle?.getHtml() ?? sanitizeCardHtml(block.html)
      }
    })
  }, [data.blocks])

  const emit = useCallback(
    (blocks: SideBlock[]) => {
      onChange?.(blocks, data.side)
    },
    [data.side, onChange]
  )

  const activeEditor = (): Editor | null => {
    const index = focusedTextIndexRef.current
    if (index == null) return null
    return textEditors.current.get(index)?.getEditor() ?? null
  }

  const focusTextAt = (index: number) => {
    textEditors.current.get(index)?.focus()
  }

  useImperativeHandle(ref, () => ({
    getBlocks: readBlocks,
    reset: () => {
      textEditors.current.forEach(ed => ed.reset())
    },
    focusFirstText: () => {
      const indexes = [...textEditors.current.keys()].sort((a, b) => a - b)
      const first = indexes[0]
      if (first != null) focusTextAt(first)
    },
    focusLastText: () => {
      const indexes = [...textEditors.current.keys()].sort((a, b) => a - b)
      const last = indexes[indexes.length - 1]
      if (last != null) focusTextAt(last)
    }
  }))

  const updateBlock = (index: number, next: SideBlock) => {
    const blocks = readBlocks()
    blocks[index] = next
    emit(blocks)
  }

  const removeBlock = (index: number) => {
    emit(readBlocks().filter((_, i) => i !== index))
  }

  const removeEmptyTextBlock = (index: number) => {
    const blocks = readBlocks()
    if (blocks.length <= 1) return

    let prevTextIndex: number | null = null
    for (let i = index - 1; i >= 0; i--) {
      if (blocks[i]?.type === 'text') {
        prevTextIndex = i
        break
      }
    }

    skipBlurRef.current = true
    setIsTextFocused(false)
    setFocusedTextIndex(null)
    emit(blocks.filter((_, i) => i !== index))

    requestAnimationFrame(() => {
      if (prevTextIndex != null) focusTextAt(prevTextIndex)
    })
  }

  const focusEmptySide = useCallback(() => {
    if (!isEditable) return

    const blocks = readBlocks()
    const last = blocks[blocks.length - 1]

    if (last?.type === 'text') {
      const indexes = [...textEditors.current.keys()].sort((a, b) => a - b)
      const lastText = indexes[indexes.length - 1]
      if (lastText != null) focusTextAt(lastText)
      return
    }

    // Click below code/media → append text and focus it.
    emit([...blocks, { type: 'text', html: '' }])
    requestAnimationFrame(() => {
      const indexes = [...textEditors.current.keys()].sort((a, b) => a - b)
      const lastText = indexes[indexes.length - 1]
      if (lastText != null) focusTextAt(lastText)
    })
  }, [isEditable, readBlocks, emit])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    return bindOverflowScroll(el)
  }, [])

  const showToolbar = !!isEditable && isTextFocused
  const focusedEditor =
    focusedTextIndex != null
      ? (textEditors.current.get(focusedTextIndex)?.getEditor() ?? null)
      : null

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={`absolute w-full h-full backface-hidden border-foreground border-6 rounded-4xl bg-card ${
        isVisible ? '' : 'pointer-events-none'
      } ${data.side === 'back' ? 'rotate-y-180' : ''}`.trim()}
      onClick={focusEmptySide}
    >
      <TextFormatToolbar
        visible={showToolbar}
        editor={focusedEditor}
        onBold={() => activeEditor()?.chain().toggleBold().run()}
        onItalic={() => activeEditor()?.chain().toggleItalic().run()}
        onUnderline={() => activeEditor()?.chain().toggleUnderline().run()}
        onBulletList={() => activeEditor()?.chain().toggleBulletList().run()}
        onNumberedList={() => activeEditor()?.chain().toggleOrderedList().run()}
      />
      <div
        ref={scrollRef}
        className="h-full w-full overflow-y-auto overscroll-y-contain scrollbar-hidden"
      >
        <div className="flex min-h-full w-full flex-col justify-center gap-4 px-4 py-4">
          {data.blocks.map((block, index) => {
            if (block.type === 'text') {
              if (!isEditable) {
                const plainLen = block.html.replace(/<[^>]*>/g, '').length
                return (
                  <div
                    key={`text-${index}`}
                    className={`w-full card-rich-text wrap-break-word ${
                      plainLen > LONGTEXT_THRESHOLD
                        ? 'is-long text-left text-lg'
                        : 'text-center text-3xl font-card leading-10'
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeCardHtml(block.html)
                    }}
                  />
                )
              }

              return (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div
                  key={`text-${index}`}
                  className="w-full"
                  onClick={e => e.stopPropagation()}
                >
                  <TextBlockEditor
                    ref={handle => {
                      if (handle) textEditors.current.set(index, handle)
                      else textEditors.current.delete(index)
                    }}
                    html={block.html}
                    isEditable={isEditable}
                    onBackspaceEmpty={() => removeEmptyTextBlock(index)}
                    onFocus={e => {
                      setFocusedTextIndex(index)
                      setIsTextFocused(true)
                      handleFocus?.(e)
                    }}
                    onBlur={e => {
                      if (skipBlurRef.current) {
                        skipBlurRef.current = false
                        return
                      }
                      if (isToolbarTarget(e.relatedTarget)) return
                      setFocusedTextIndex(null)
                      setIsTextFocused(false)
                      const html =
                        textEditors.current.get(index)?.getHtml() ??
                        sanitizeCardHtml(block.html)
                      updateBlock(index, { type: 'text', html })
                      handleBlur?.(e)
                    }}
                  />
                </div>
              )
            }

            if (block.type === 'code') {
              return (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div
                  key={`code-${index}`}
                  className="w-full"
                  onClick={e => e.stopPropagation()}
                >
                  <Suspense fallback={<Spinner />}>
                    <CodeBlockEditor
                      value={{ lang: block.lang, code: block.code }}
                      isEditable={isEditable}
                      onFocus={() => {
                        setIsTextFocused(false)
                        handleFocus?.({} as FocusEvent<HTMLElement>)
                      }}
                      onChange={value =>
                        updateBlock(index, { type: 'code', ...value })
                      }
                      onRemove={
                        isEditable ? () => removeBlock(index) : undefined
                      }
                    />
                  </Suspense>
                </div>
              )
            }

            if (block.type === 'image') {
              return (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div
                  key={`image-${index}`}
                  className="relative w-full"
                  onClick={e => {
                    e.stopPropagation()
                    if (!isEditable) return
                    setIsTextFocused(false)
                    handleFocus?.({} as FocusEvent<HTMLElement>)
                  }}
                >
                  {isEditable ? (
                    <ObjectUrl record={block.content}>
                      {url => (
                        <ImageUploader
                          onChange={file =>
                            updateBlock(index, {
                              type: 'image',
                              content: file
                            })
                          }
                          onRemove={() => removeBlock(index)}
                          initialPreview={url}
                        />
                      )}
                    </ObjectUrl>
                  ) : (
                    <ObjectUrl record={block.content}>
                      {url => (
                        <img
                          src={url}
                          alt={`${data.side} side`}
                          draggable={false}
                          className="max-w-full max-h-[40dvh] mx-auto object-contain"
                        />
                      )}
                    </ObjectUrl>
                  )}
                </div>
              )
            }

            return (
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
              <div
                key={`audio-${index}`}
                className="relative w-full bg-muted rounded-xl"
                onClick={e => {
                  e.stopPropagation()
                  if (!isEditable) return
                  setIsTextFocused(false)
                  handleFocus?.({} as FocusEvent<HTMLElement>)
                }}
              >
                {isEditable && (
                  <MediaToolbar
                    removeLabel="Remove audio"
                    changeLabel="Change audio"
                    onRemove={() => removeBlock(index)}
                  >
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        const buffer = await file.arrayBuffer()
                        updateBlock(index, {
                          type: 'audio',
                          content: {
                            buffer,
                            type: file.type || 'audio/mpeg'
                          }
                        })
                      }}
                    />
                  </MediaToolbar>
                )}
                <ObjectUrl record={block.content}>
                  {url => (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio controls src={url} className="w-full max-w-full" />
                  )}
                </ObjectUrl>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
