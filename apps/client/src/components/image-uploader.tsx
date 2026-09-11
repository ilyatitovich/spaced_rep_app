import type { ChangeEvent } from 'react'
import { useRef, useState, useEffect } from 'react'

import MediaToolbar from './media-toolbar'
import { Spinner } from './ui'
import { blobToRecord, processImage } from '@/lib'
import { MediaDBRecord } from '@/types'

type ImageUploaderProps = {
  onChange?: (file: MediaDBRecord) => void
  onRemove?: () => void
  initialPreview?: string
}

export default function ImageUploader({
  onChange,
  onRemove,
  initialPreview
}: ImageUploaderProps) {
  const [ownedUrl, setOwnedUrl] = useState('')
  const [isConverting, setIsConverting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const preview = ownedUrl || initialPreview || ''

  useEffect(() => {
    return () => {
      if (ownedUrl) URL.revokeObjectURL(ownedUrl)
    }
  }, [ownedUrl])

  const handleSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsConverting(true)

    try {
      if (ownedUrl) URL.revokeObjectURL(ownedUrl)

      const webpBlob = await processImage(file)
      const previewUrl = URL.createObjectURL(webpBlob)
      const record = await blobToRecord(webpBlob)

      setOwnedUrl(previewUrl)
      onChange?.(record)
    } catch (err) {
      console.error('Failed to convert image:', err)
    } finally {
      setIsConverting(false)
    }
  }

  if (isConverting) return <Spinner />

  return (
    <>
      {preview ? (
        <div className="flex flex-col items-center w-full bg-muted rounded-xl pb-4">
          {onRemove && (
            <MediaToolbar
              removeLabel="Remove image"
              changeLabel="Change image"
              onRemove={onRemove}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSelect}
              />
            </MediaToolbar>
          )}
          <img
            src={preview}
            alt="preview"
            draggable={false}
            className="w-60 max-h-[48dvh] rounded-xl object-contain border border-foreground-muted"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-6 py-3 border border-primary rounded-xl text-primary"
        >
          Click to upload image
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelect}
      />
    </>
  )
}
