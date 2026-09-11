import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'

type ImageFrameProps = {
  src: string
  alt?: string
  className?: string
  placeholderClassName?: string
  onFailedChange?: (failed: boolean) => void
}

export default function ImageFrame({
  src,
  alt = '',
  className = '',
  placeholderClassName = '',
  onFailedChange
}: ImageFrameProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    onFailedChange?.(false)
  }, [src, onFailedChange])

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt || 'Image unavailable'}
        className={`flex flex-col items-center justify-center gap-2 text-foreground-muted ${
          placeholderClassName || `bg-muted ${className}`
        }`.trim()}
      >
        <ImageOff className="w-8 h-8" strokeWidth={1.75} />
        <span className="text-sm">Image unavailable</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={className}
      onError={() => {
        setFailed(true)
        onFailedChange?.(true)
      }}
    />
  )
}
