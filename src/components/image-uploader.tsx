import type { ChangeEvent } from 'react'
import { useRef, useState, useEffect } from 'react'

import { Spinner } from './ui'
import { processImage } from '@/lib'

type ImageUploaderProps = {
  onChange?: (file: Blob) => void
  initialPreview?: string
}

export default function ImageUploader({
  onChange,
  initialPreview
}: ImageUploaderProps) {
  const [preview, setPreview] = useState(initialPreview)
  const [isConverting, setIsConverting] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

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

      setPreview(previewUrl)
      onChange?.(webpBlob)
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
        <div className="flex flex-col items-center">
          <img
            src={preview}
            alt="preview"
            className="w-60 max-h-[48dvh] rounded-xl object-contain"
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2.5 text-lg font-bold text-purple-600"
          >
            Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-6 py-3 border border-purple-500 rounded-xl text-purple-600"
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
