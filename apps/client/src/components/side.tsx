import type { FocusEvent, FocusEventHandler, Ref } from 'react'
import type { CardSideData, SideBlock, SideName } from '@/types'
import type { Editor } from '@tiptap/react'
import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from 'react'

import AudioBlock from './content/audio-block/audio-block'
import ImageBlock from './content/image-block/image-block'
import TextBlockEditor, {
  type TextBlockEditorHandle
} from './content/text-block/text-block-editor'
import TextFormatToolbar, {
  isToolbarTarget
} from './content/text-block/text-format-toolbar'
import { Spinner } from './ui'
import {
  didAppendSideBlock,
  LONGTEXT_THRESHOLD,
  renderMathInHtml,
  sanitizeCardHtml
} from '@/lib'

const CodeBlockEditor = lazy(
  () => import('./content/code-block/code-block-editor')
)

// Match `duration-600` on the card rotator in card.tsx.
const FLIP_MS = 600

function bindOverflowScroll(el: HTMLElement) {
  const onWheel = (e: WheelEvent) => {
    if (el.scrollHeight <= el.clientHeight) return
    el.scrollTop += e.deltaY
    e.preventDefault()
  }

  el.addEventListener('wheel', onWheel, { passive: false })
  return () => el.removeEventListener('wheel', onWheel)
}

function revealLastBlock(root: HTMLElement) {
  const inner = root.firstElementChild
  if (!(inner instanceof HTMLElement)) return

  const reveal = () => {
    root.scrollTop = root.scrollHeight - root.clientHeight
  }

  reveal()
  const ro = new ResizeObserver(reveal)
  ro.observe(inner)
  // ponytail: 1s is enough for image decode / lazy code; disconnect so typing doesn't pin scroll
  const t = window.setTimeout(() => ro.disconnect(), 1000)
  return () => {
    window.clearTimeout(t)
    ro.disconnect()
  }
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
  {
    data,
    isEditable,
    isVisible = true,
    handleFocus,
    handleBlur,
    onChange
  }: SideProps,
  ref: Ref<SideHandle>
) {
  const [isTextFocused, setIsTextFocused] = useState(false)
  const [focusedTextIndex, setFocusedTextIndex] = useState<number | null>(null)
  const textEditors = useRef<Map<number, TextBlockEditorHandle>>(new Map())
  const codeEditors = useRef<Map<number, { focus: () => void }>>(new Map())
  const focusedTextIndexRef = useRef<number | null>(null)
  const skipBlurRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevBlocksRef = useRef<SideBlock[] | null>(null)
  const stopRevealRef = useRef<(() => void) | null>(null)
  const [isPainted, setIsPainted] = useState(true)
  focusedTextIndexRef.current = focusedTextIndex

  useEffect(() => {
    if (isVisible) {
      setIsPainted(true)
      return
    }
    // Hide at 90° so iOS cannot keep painting the outgoing img/audio layer.
    const id = window.setTimeout(() => setIsPainted(false), FLIP_MS / 2)
    return () => window.clearTimeout(id)
  }, [isVisible])

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
      for (let i = data.blocks.length - 1; i >= 0; i--) {
        const type = data.blocks[i]?.type
        if (type === 'code') {
          codeEditors.current.get(i)?.focus()
          return
        }
        if (type === 'text') {
          focusTextAt(i)
          return
        }
      }
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
    if (!isEditable) return
    void import('./content/code-block/code-block-editor')
  }, [isEditable])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    return bindOverflowScroll(el)
  }, [])

  useLayoutEffect(() => {
    const prev = prevBlocksRef.current
    prevBlocksRef.current = data.blocks
    if (prev == null || !didAppendSideBlock(prev, data.blocks)) return
    const root = scrollRef.current
    if (!root) return
    // Don't return this as effect cleanup: text blur rewrites `blocks` and
    // would kill the observer before lazy CodeMirror / image decode settle.
    stopRevealRef.current?.()
    stopRevealRef.current = revealLastBlock(root) ?? null
  }, [data.blocks])

  useEffect(() => () => stopRevealRef.current?.(), [])

  const showToolbar = !!isEditable && isTextFocused
  const focusedEditor =
    focusedTextIndex != null
      ? (textEditors.current.get(focusedTextIndex)?.getEditor() ?? null)
      : null

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={`card-face absolute w-full h-full ${
        isVisible ? '' : 'pointer-events-none'
      } ${isPainted ? '' : 'hidden'} ${
        data.side === 'back' ? 'card-face-back' : ''
      }`.trim()}
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
      <div className="h-full w-full overflow-hidden border-foreground border-6 rounded-4xl bg-card">
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
                        __html: renderMathInHtml(sanitizeCardHtml(block.html))
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
                        ref={handle => {
                          if (handle) codeEditors.current.set(index, handle)
                          else codeEditors.current.delete(index)
                        }}
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
                  <ImageBlock
                    key={`image-${index}`}
                    content={block.content}
                    isEditable={isEditable}
                    alt={`${data.side} side`}
                    onChange={content =>
                      updateBlock(index, { type: 'image', content })
                    }
                    onRemove={() => removeBlock(index)}
                    onFocus={() => {
                      setIsTextFocused(false)
                      handleFocus?.({} as FocusEvent<HTMLElement>)
                    }}
                  />
                )
              }

              return (
                <AudioBlock
                  key={`audio-${index}`}
                  content={block.content}
                  isEditable={isEditable}
                  onChange={content =>
                    updateBlock(index, { type: 'audio', content })
                  }
                  onRemove={() => removeBlock(index)}
                  onFocus={() => {
                    setIsTextFocused(false)
                    handleFocus?.({} as FocusEvent<HTMLElement>)
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
})
