import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import ImageFrame from './image-frame'

type ImageViewerProps = {
  isOpen: boolean
  imageUrl: string
  alt?: string
  onClose: () => void
}

export default function ImageViewer({
  isOpen,
  imageUrl,
  alt = 'Image',
  onClose
}: ImageViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = !isOpen
  }, [isOpen])

  return createPortal(
    <div
      ref={rootRef}
      data-screen=""
      className={`fixed inset-0 z-60 flex items-center justify-center transition-opacity duration-300 ${
        isOpen ? 'opacity-100 starting:opacity-0' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Full screen image"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/95"
        onClick={onClose}
        onPointerDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      />
      <button
        type="button"
        aria-label="Close"
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/15 text-white"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>
      <div className="relative z-10 max-w-full max-h-full p-4">
        <ImageFrame
          src={imageUrl}
          alt={alt}
          className="max-w-full max-h-[90dvh] object-contain"
          placeholderClassName="w-60 h-40 rounded-xl bg-white/10 text-white/70"
        />
      </div>
    </div>,
    document.body
  )
}
