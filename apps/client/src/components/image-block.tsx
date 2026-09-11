import type { ChangeEvent, MouseEvent, TouchEvent } from 'react'
import { useState } from 'react'

import MediaToolbar from './media-toolbar'
import ObjectUrl from './object-url'
import ImageViewer from './image-viewer'
import ImageEditorScreen from './screens/image-editor'
import { Spinner } from './ui'
import { blobToRecord, processImage } from '@/lib'
import type { MediaDBRecord } from '@/types'

type ImageBlockProps = {
  content: MediaDBRecord
  isEditable?: boolean
  onChange?: (content: MediaDBRecord) => void
  onRemove?: () => void
  onFocus?: () => void
  alt?: string
}

export default function ImageBlock({
  content,
  isEditable,
  onChange,
  onRemove,
  onFocus,
  alt = 'Card image'
}: ImageBlockProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setIsConverting(true)
    try {
      const webp = await processImage(file)
      onChange?.(await blobToRecord(webp))
    } catch (err) {
      console.error('Failed to convert image:', err)
    } finally {
      setIsConverting(false)
    }
  }

  const stopCardTap = (e: TouchEvent | MouseEvent) => {
    e.stopPropagation()
  }

  if (isConverting) return <Spinner />

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="relative w-full"
      onClick={e => {
        e.stopPropagation()
        if (!isEditable) return
        onFocus?.()
      }}
      onTouchStart={stopCardTap}
      onTouchEnd={stopCardTap}
    >
      {isEditable ? (
        <div className="flex flex-col items-center w-full bg-muted rounded-xl pb-4">
          {onRemove && (
            <MediaToolbar
              removeLabel="Remove image"
              changeLabel="Change image"
              editLabel="Crop image"
              onRemove={onRemove}
              onEdit={() => setIsEditorOpen(true)}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleChange}
              />
            </MediaToolbar>
          )}
          <ObjectUrl record={content}>
            {url => (
              <>
                <img
                  src={url}
                  alt={alt}
                  draggable={false}
                  className="w-60 max-h-[48dvh] rounded-xl object-contain backface-hidden"
                />
                <ImageEditorScreen
                  isOpen={isEditorOpen}
                  imageUrl={url}
                  onClose={() => setIsEditorOpen(false)}
                  onSave={record => onChange?.(record)}
                />
              </>
            )}
          </ObjectUrl>
        </div>
      ) : (
        <ObjectUrl record={content}>
          {url => (
            <>
              <button
                type="button"
                className="block w-full"
                aria-label="View image full screen"
                onClick={() => setIsViewerOpen(true)}
              >
                <img
                  src={url}
                  alt={alt}
                  draggable={false}
                  className="max-w-full max-h-[40dvh] mx-auto object-contain backface-hidden"
                />
              </button>
              <ImageViewer
                isOpen={isViewerOpen}
                imageUrl={url}
                alt={alt}
                onClose={() => setIsViewerOpen(false)}
              />
            </>
          )}
        </ObjectUrl>
      )}
    </div>
  )
}
