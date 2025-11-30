import type { ChangeEvent } from 'react'
import { useRef, useState } from 'react'

import { processImage } from '@/lib'

// Add image size restriction and validation as needed
// For example, limit to 5MB and specific formats
// Add error handling for unsupported formats
// and display appropriate messages to the user
// Loaders can be added for better UX during conversion
// Add photo support

type ImageUploaderProps = {
  onChange?: (file: Blob) => void
  initialPreview?: string
}

export default function ImageUploader({
  onChange,
  initialPreview
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState(initialPreview)
  const [isConverting, setIsConverting] = useState(false)

  const handleSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log(file.size)

    try {
      setIsConverting(true)

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

  return (
    <div className="flex flex-col items-center gap-3">
      {!preview && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-6 py-3 rounded-xl border border-gray-400 text-gray-600 bg-white hover:bg-gray-50 transition"
        >
          {isConverting ? 'Processing...' : 'Click to upload image'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelect}
      />

      {preview && (
        <div className="flex flex-col items-center">
          <img
            src={preview}
            alt="preview"
            className="w-60 max-h-[48dvh] rounded-xl"
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2.5 text-lg font-bold text-purple-600"
          >
            Change
          </button>
        </div>
      )}
    </div>
  )
}
