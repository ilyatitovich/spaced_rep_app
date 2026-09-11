import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

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
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          onPointerDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Full screen image"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/15 text-white"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="max-w-full max-h-full p-4"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            role="presentation"
          >
            <ImageFrame
              src={imageUrl}
              alt={alt}
              className="max-w-full max-h-[90dvh] object-contain"
              placeholderClassName="w-60 h-40 rounded-xl bg-white/10 text-white/70"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
