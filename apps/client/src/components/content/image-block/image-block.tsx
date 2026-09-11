import type { ChangeEvent, MouseEvent, TouchEvent } from 'react'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

import MediaToolbar from '../media-toolbar'
import ObjectUrl from '../object-url'
import ImageFrame from './image-frame'
import ImageViewer from './image-viewer'
import ImageEditorScreen from '../../screens/image-editor'
import { Spinner } from '@/components/ui'
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
  const [hasLoadFailed, setHasLoadFailed] = useState(false)

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
      toast.error('Couldn’t process that image. Try another file.')
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
              onEdit={hasLoadFailed ? undefined : () => setIsEditorOpen(true)}
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
                <ImageFrame
                  src={url}
                  alt={alt}
                  className="w-60 max-h-[48dvh] rounded-xl object-contain"
                  placeholderClassName="w-60 h-40 rounded-xl bg-muted"
                  onFailedChange={setHasLoadFailed}
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
              {hasLoadFailed ? (
                <ImageFrame
                  src={url}
                  alt={alt}
                  className="max-w-full max-h-[40dvh] mx-auto object-contain"
                  placeholderClassName="w-full h-32 rounded-xl mx-auto bg-muted"
                  onFailedChange={setHasLoadFailed}
                />
              ) : (
                <button
                  type="button"
                  className="block w-full"
                  aria-label="View image full screen"
                  onClick={() => setIsViewerOpen(true)}
                >
                  <ImageFrame
                    src={url}
                    alt={alt}
                    className="max-w-full max-h-[40dvh] mx-auto object-contain"
                    placeholderClassName="w-full h-32 rounded-xl mx-auto bg-muted"
                    onFailedChange={setHasLoadFailed}
                  />
                </button>
              )}
              <ImageViewer
                isOpen={isViewerOpen && !hasLoadFailed}
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
