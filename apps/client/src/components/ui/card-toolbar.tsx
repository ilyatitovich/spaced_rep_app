import { useRef, type ChangeEvent } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'react-hot-toast'

import CardButton from './card-button'
import { AUDIO_FILE_ACCEPT } from '@/lib/constants'
import { blobToRecord, processImage } from '@/lib/image'
import { runInTapFocus } from '@/lib/pwa'
import type { CodeLang } from '@/lib/code-lang'
import type { MediaDBRecord, SideBlock } from '@/types'

type CardToolbarProps = {
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
    try {
      const webp = await processImage(file)
      const record = await blobToRecord(webp)
      onAddBlocks([{ type: 'image', content: record }])
    } catch (err) {
      console.error('Failed to add image:', err)
      toast.error('Couldn’t process that image. Try another file.')
    }
  }

  const handlePickAudio = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const content: MediaDBRecord = { buffer, type: file.type || 'audio/mpeg' }
      onAddBlocks([{ type: 'audio', content }])
    } catch (err) {
      console.error('Failed to add audio:', err)
    }
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
