import type { ChangeEvent, MouseEvent, TouchEvent } from 'react'
import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

import MediaToolbar from '../media-toolbar'
import ObjectUrl from '../object-url'
import ImageFrame from './image-frame'
import ImageViewer from './image-viewer'
import ImageEditorScreen from '../../screens/image-editor'
import { Spinner } from '@/components/ui'
import { blobToRecord, processImage } from '@/lib'
import type { ImageContent, MediaDBRecord } from '@/types'

type ImageBlockProps = {
  content: ImageContent
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

  // Packed buffers only; remote { src } rendering is render-cache.
  if (!('buffer' in content)) return null

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="relative w-full"
      onClick={e => {
        if (!isEditable) return
        e.stopPropagation()
        onFocus?.()
      }}
      onTouchStart={isEditable ? stopCardTap : undefined}
      onTouchEnd={isEditable ? stopCardTap : undefined}
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
              <div className="relative mx-auto w-fit max-w-full">
                <ImageFrame
                  src={url}
                  alt={alt}
                  className="max-w-full max-h-[40dvh] mx-auto object-contain"
                  placeholderClassName="w-full h-32 rounded-xl mx-auto bg-muted"
                  onFailedChange={setHasLoadFailed}
                />
                {!hasLoadFailed && (
                  <button
                    type="button"
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/50 text-white"
                    aria-label="View image full screen"
                    onClick={e => {
                      e.stopPropagation()
                      setIsViewerOpen(true)
                    }}
                    onTouchStart={stopCardTap}
                    onTouchEnd={stopCardTap}
                  >
                    <Maximize2 className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                )}
              </div>
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
