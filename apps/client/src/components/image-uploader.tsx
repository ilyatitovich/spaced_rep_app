import type { ChangeEvent } from 'react'
import { useRef, useState, useEffect } from 'react'
import { SquarePen, Trash2 } from 'lucide-react'

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
  const [preview, setPreview] = useState('')
  const [isConverting, setIsConverting] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (initialPreview) {
      setPreview(initialPreview)
    }

    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [initialPreview, preview])

  const handleSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsConverting(true)

    try {
      if (preview) {
        URL.revokeObjectURL(preview)
      }

      const webpBlob = await processImage(file)
      const previewUrl = URL.createObjectURL(webpBlob)
      const record = await blobToRecord(webpBlob)

      setPreview(previewUrl)
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
        <div className="flex flex-col items-center w-full">
          {onRemove && (
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                className="p-1"
                aria-label="Remove image"
                onClick={onRemove}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1"
                aria-label="Change image"
                onClick={() => inputRef.current?.click()}
              >
                <SquarePen className="w-4 h-4" />
              </button>
            </div>
          )}
          <img
            src={preview}
            alt="preview"
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
