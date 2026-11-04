import { useRef, type ChangeEvent } from 'react'
import { flushSync } from 'react-dom'

import CardButton from './card-button'
import { attachCardMediaFile } from '@/lib/attach-card-media'
import { AUDIO_FILE_ACCEPT } from '@/lib/constants'
import { runInTapFocus } from '@/lib/pwa'
import type { CodeLang } from '@/lib/code-lang'
import type { SideBlock } from '@/types'

interface CardToolbarProps {
  isTextDisabled: boolean
  onAddBlocks: (blocks: SideBlock[]) => void
  onFocusLast: () => void
  onFlip: () => void
}

export default function CardToolbar({
  isTextDisabled,
  onAddBlocks,
  onFocusLast,
  onFlip
}: CardToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const handleAddText = () => {
    onAddBlocks([{ type: 'text', html: '' }])
    requestAnimationFrame(onFocusLast)
  }

  const handleAddCode = (lang: CodeLang) => {
    runInTapFocus(() => {
      flushSync(() => {
        onAddBlocks([{ type: 'code', lang, code: '' }])
      })
      onFocusLast()
    })
  }

  const handleSelectMedia = (kind: 'image' | 'audio') => {
    if (kind === 'image') imageInputRef.current?.click()
    else audioInputRef.current?.click()
  }

  const handlePickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const block = await attachCardMediaFile(file, 'image')
    if (block) onAddBlocks([block])
  }

  const handlePickAudio = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const block = await attachCardMediaFile(file, 'audio')
    if (block) onAddBlocks([block])
  }

  return (
    <>
      <div className="pt-1 flex justify-center items-center gap-10">
        <CardButton
          type="text"
          isDisabled={isTextDisabled}
          onClick={handleAddText}
        />
        <CardButton type="media" onSelectMedia={handleSelectMedia} />
        <CardButton type="code" onSelectCode={handleAddCode} />
        <CardButton type="flip" onClick={onFlip} />
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePickImage}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept={AUDIO_FILE_ACCEPT}
        className="hidden"
        onChange={handlePickAudio}
      />
    </>
  )
}
