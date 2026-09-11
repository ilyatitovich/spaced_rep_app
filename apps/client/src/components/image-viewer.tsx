import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

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
          <img
            src={imageUrl}
            alt={alt}
            draggable={false}
            className="max-w-full max-h-full object-contain p-4"
            onClick={e => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
