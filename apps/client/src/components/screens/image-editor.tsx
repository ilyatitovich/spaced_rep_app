import type { MediaDBRecord } from '@/types'
import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, RotateCw } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { Area } from 'react-easy-crop'

import { Button, Header, Screen, Spinner } from '@/components'
import { blobToRecord, getCroppedImage } from '@/lib'

const Cropper = lazy(() => import('react-easy-crop'))

type ImageEditorScreenProps = {
  isOpen: boolean
  imageUrl: string
  onClose: () => void
  onSave: (record: MediaDBRecord) => void
}

export default function ImageEditorScreen({
  isOpen,
  imageUrl,
  onClose,
  onSave
}: ImageEditorScreenProps) {
  const [hasOpened, setHasOpened] = useState(false)
  // Mount closed first so Screen can transition in; isOpen alone would paint already open.
  const [isVisible, setIsVisible] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [aspect, setAspect] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [naturalAspect, setNaturalAspect] = useState(4 / 3)

  useEffect(() => {
    if (isOpen) {
      setHasOpened(true)
      // Paint closed (translate-y-100vh) first, then open — otherwise first paint skips the enter transition.
      let inner = 0
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setIsVisible(true))
      })
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
      }
    }
    setIsVisible(false)
  }, [isOpen])

  const handleCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleMediaLoaded = useCallback(
    (mediaSize: { naturalWidth: number; naturalHeight: number }) => {
      if (mediaSize.naturalWidth && mediaSize.naturalHeight) {
        setNaturalAspect(mediaSize.naturalWidth / mediaSize.naturalHeight)
      }
    },
    []
  )

  const handleDone = async () => {
    if (!croppedAreaPixels || isSaving) return
    setIsSaving(true)
    try {
      const blob = await getCroppedImage(imageUrl, croppedAreaPixels, rotation)
      const record = await blobToRecord(blob)
      onSave(record)
      onClose()
    } catch (err) {
      console.error('Failed to save cropped image:', err)
      toast.error('Couldn’t save the crop. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setCroppedAreaPixels(null)
    setAspect(null)
    setIsSaving(false)
    setHasOpened(false)
  }

  if (!hasOpened) return null

  return createPortal(
    <Screen isOpen={isVisible} isVertical onClose={handleClose} className="z-60">
      <div className="h-full bg-background flex flex-col overflow-hidden">
        <Header>
          <Button ariaLabel="Cancel" data-dismiss="" onClick={onClose}>
            <ChevronLeft size={28} />
          </Button>
          <span>Edit image</span>
          <Button
            disabled={isSaving || !croppedAreaPixels}
            onClick={handleDone}
          >
            Done
          </Button>
        </Header>

        <div className="relative flex-1 bg-black">
          <Suspense fallback={<Spinner />}>
            {isVisible && (
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect ?? naturalAspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                onMediaLoaded={handleMediaLoaded}
              />
            )}
          </Suspense>
        </div>

        <div className="flex flex-col gap-4 p-4 pb-8">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAspect(null)}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  aspect === null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => setAspect(1)}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  aspect === 1
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                1:1
              </button>
              <button
                type="button"
                onClick={() => setAspect(4 / 3)}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  aspect === 4 / 3
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                4:3
              </button>
            </div>

            <button
              type="button"
              aria-label="Rotate 90 degrees"
              onClick={() => setRotation(prev => (prev + 90) % 360)}
              className="p-2 rounded-lg bg-secondary text-foreground"
            >
              <RotateCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </Screen>,
    document.body
  )
}
