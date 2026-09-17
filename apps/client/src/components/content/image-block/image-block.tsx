import type { ChangeEvent, MouseEvent, TouchEvent } from 'react'
import { useEffect, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

import MediaToolbar from '../media-toolbar'
import ObjectUrl from '../object-url'
import ImageFrame from './image-frame'
import ImageViewer from './image-viewer'
import ImageEditorScreen from '../../screens/image-editor'
import Spinner from '@/components/ui/spinner'
import { useOnline } from '@/hooks/use-online'
import { cacheRemoteImage, toHttpsImageUrl } from '@/lib/cache-remote-image'
import { blobToRecord, processImage } from '@/lib/image'
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
  const isOnline = useOnline()
  const remoteSrc = 'src' in content ? content.src : null
  const [cachedRemote, setCachedRemote] = useState<MediaDBRecord | null>(null)
  const [remoteCacheChecked, setRemoteCacheChecked] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [hasLoadFailed, setHasLoadFailed] = useState(false)

  useEffect(() => {
    if (!remoteSrc) {
      setCachedRemote(null)
      setRemoteCacheChecked(false)
      return
    }

    let cancelled = false
    setCachedRemote(null)
    setRemoteCacheChecked(false)
    setHasLoadFailed(false)

    void cacheRemoteImage(remoteSrc).then(record => {
      if (cancelled) return
      if (record) setCachedRemote({ buffer: record.buffer, type: record.type })
      setRemoteCacheChecked(true)
    })

    return () => {
      cancelled = true
    }
  }, [remoteSrc, isOnline])

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

  const bufferRecord: MediaDBRecord | null =
    'buffer' in content ? content : cachedRemote
  const httpsUrl = remoteSrc ? toHttpsImageUrl(remoteSrc) : null
  const showOfflinePlaceholder =
    !!remoteSrc && remoteCacheChecked && !cachedRemote && !isOnline
  // Online miss: paint from URL while cacheRemoteImage runs in the background.
  const liveRemoteUrl = remoteSrc && !bufferRecord && isOnline ? httpsUrl : null
  const pendingOfflineCache =
    !!remoteSrc && !remoteCacheChecked && !isOnline && !bufferRecord

  const placeholderClassName = isEditable
    ? 'w-60 h-40 rounded-xl bg-muted'
    : 'w-full h-32 rounded-xl mx-auto bg-muted'

  const renderFrame = (src: string | undefined) => (
    <ImageFrame
      src={src}
      alt={alt}
      offlineExternal={showOfflinePlaceholder}
      className={
        isEditable
          ? 'w-60 max-h-[48dvh] rounded-xl object-contain'
          : 'max-w-full max-h-[40dvh] mx-auto object-contain'
      }
      placeholderClassName={placeholderClassName}
      onFailedChange={setHasLoadFailed}
    />
  )

  const renderWithUrl = (url: string) => (
    <>
      {isEditable ? (
        <>
          {renderFrame(url)}
          {bufferRecord && (
            <ImageEditorScreen
              isOpen={isEditorOpen}
              imageUrl={url}
              onClose={() => setIsEditorOpen(false)}
              onSave={record => onChange?.(record)}
            />
          )}
        </>
      ) : (
        <>
          <div className="relative mx-auto w-fit max-w-full">
            {renderFrame(url)}
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
    </>
  )

  const remoteFallback = pendingOfflineCache ? (
    <div className={placeholderClassName} aria-hidden />
  ) : (
    renderFrame(liveRemoteUrl ?? undefined)
  )

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
              onEdit={
                hasLoadFailed || !bufferRecord
                  ? undefined
                  : () => setIsEditorOpen(true)
              }
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleChange}
              />
            </MediaToolbar>
          )}
          {bufferRecord ? (
            <ObjectUrl record={bufferRecord}>
              {url => renderWithUrl(url)}
            </ObjectUrl>
          ) : (
            remoteFallback
          )}
        </div>
      ) : bufferRecord ? (
        <ObjectUrl record={bufferRecord}>{url => renderWithUrl(url)}</ObjectUrl>
      ) : liveRemoteUrl ? (
        renderWithUrl(liveRemoteUrl)
      ) : (
        remoteFallback
      )}
    </div>
  )
}
