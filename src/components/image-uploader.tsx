import type { ChangeEvent } from 'react'
import { useRef, useState } from 'react'

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
  const [preview, setPreview] = useState<string | null>(initialPreview || null)
  const [isConverting, setIsConverting] = useState(false)

  const handleSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsConverting(true)

      const webpBlob = await convertToWebP(file)
      const previewUrl = URL.createObjectURL(webpBlob)

      setPreview(previewUrl)
      onChange?.(webpBlob)
    } catch (err) {
      console.error('Failed to convert image:', err)
    } finally {
      setIsConverting(false)
    }
  }

  const convertToWebP = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject('Canvas context missing')

        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          blob => {
            if (!blob) return reject('Failed to convert to WebP')
            resolve(blob)
          },
          'image/webp',
          0.85 // quality
        )
      }

      img.onerror = () => reject('Image load error')
      img.src = URL.createObjectURL(file)
    })

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
            className="w-60 max-h-[48dvh] object-contain"
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-4 text-sm text-blue-600 underline hover:text-blue-800"
          >
            Change
          </button>
        </div>
      )}
    </div>
  )
}
