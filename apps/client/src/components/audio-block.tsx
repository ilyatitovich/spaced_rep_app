import type { ChangeEvent } from 'react'
import type { MediaDBRecord } from '@/types'
import MediaToolbar from './media-toolbar'
import ObjectUrl from './object-url'
import { AUDIO_FILE_ACCEPT } from '@/lib'

type AudioBlockProps = {
  content: MediaDBRecord
  isEditable?: boolean
  onChange?: (content: MediaDBRecord) => void
  onRemove?: () => void
  onFocus?: () => void
}

export default function AudioBlock({
  content,
  isEditable,
  onChange,
  onRemove,
  onFocus
}: AudioBlockProps) {
  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const buffer = await file.arrayBuffer()
    onChange?.({
      buffer,
      type: file.type || 'audio/mpeg'
    })
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="relative w-full bg-muted rounded-xl"
      onClick={e => {
        e.stopPropagation()
        if (!isEditable) return
        onFocus?.()
      }}
    >
      {isEditable && onRemove && (
        <MediaToolbar
          removeLabel="Remove audio"
          changeLabel="Change audio"
          onRemove={onRemove}
        >
          <input
            type="file"
            accept={AUDIO_FILE_ACCEPT}
            className="hidden"
            onChange={handleChange}
          />
        </MediaToolbar>
      )}
      <ObjectUrl record={content}>
        {url => (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio
            controls
            src={url}
            className="w-full max-w-full backface-hidden"
          />
        )}
      </ObjectUrl>
    </div>
  )
}
