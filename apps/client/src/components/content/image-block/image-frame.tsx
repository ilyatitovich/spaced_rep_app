import { useEffect, useState } from 'react'
import { CloudOff, ImageOff } from 'lucide-react'

const OFFLINE_EXTERNAL_LABEL =
  'You’re offline. This image is on an external host.'

type ImageFrameProps = {
  src?: string
  alt?: string
  className?: string
  placeholderClassName?: string
  onFailedChange?: (failed: boolean) => void
  /** Uncached remote image while offline — distinct from load failure. */
  offlineExternal?: boolean
}

export default function ImageFrame({
  src,
  alt = '',
  className = '',
  placeholderClassName = '',
  onFailedChange,
  offlineExternal = false
}: ImageFrameProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    onFailedChange?.(false)
  }, [src, onFailedChange])

  if (offlineExternal) {
    return (
      <div
        role="img"
        aria-label={OFFLINE_EXTERNAL_LABEL}
        className={`flex flex-col items-center justify-center gap-2 text-foreground-muted ${
          placeholderClassName || `bg-muted ${className}`
        }`.trim()}
      >
        <CloudOff className="w-8 h-8" strokeWidth={1.75} />
        <span className="text-sm text-center px-3">{OFFLINE_EXTERNAL_LABEL}</span>
      </div>
    )
  }

  if (failed || !src) {
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
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <img
      src={src}
      alt={alt}
      draggable={false}
      onDragStart={event => event.preventDefault()}
      className={`[-webkit-user-drag:none] touch-none ${className}`.trim()}
      onError={() => {
        setFailed(true)
        onFailedChange?.(true)
      }}
    />
  )
}
