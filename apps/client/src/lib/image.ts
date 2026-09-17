import type { ImageBase64Record, MediaDBRecord } from '@/types'

export type CropArea = {
  x: number
  y: number
  width: number
  height: number
}

const MAX_WIDTH = 800
const MAX_HEIGHT = 800
const WEBP_QUALITY = 0.85

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) return reject(new Error('Failed to convert to Webp'))
        resolve(blob)
      },
      'image/webp',
      WEBP_QUALITY
    )
  })
}

function scaleToMax(width: number, height: number) {
  if (width <= MAX_WIDTH && height <= MAX_HEIGHT) {
    return { width, height }
  }
  const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio)
  }
}

function getRadianAngle(degree: number) {
  return (degree * Math.PI) / 180
}

export function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', error => reject(error))
    image.src = src
  })
}

export async function processImage(file: Blob): Promise<Blob> {
  const img = await createImageBitmap(file, {
    imageOrientation: 'from-image'
  })

  const { width, height } = scaleToMax(img.width, img.height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx!.fillStyle = 'white'
  ctx!.fillRect(0, 0, width, height)
  ctx?.drawImage(img, 0, 0, width, height)

  return canvasToWebp(canvas)
}

/** Crop + rotate, then run through the same WebP/800 pipeline as uploads. */
export async function getCroppedImage(
  imageSrc: string,
  pixelCrop: CropArea,
  rotation = 0
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const rotRad = getRadianAngle(rotation)
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  )

  const canvas = document.createElement('canvas')
  canvas.width = bBoxWidth
  canvas.height = bBoxHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.translate(-image.width / 2, -image.height / 2)
  ctx.drawImage(image, 0, 0)

  const cropped = document.createElement('canvas')
  cropped.width = pixelCrop.width
  cropped.height = pixelCrop.height
  const croppedCtx = cropped.getContext('2d')
  if (!croppedCtx) throw new Error('Canvas context unavailable')

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  const croppedBlob = await new Promise<Blob>((resolve, reject) => {
    cropped.toBlob(blob => {
      if (!blob) return reject(new Error('Failed to crop image'))
      resolve(blob)
    }, 'image/png')
  })

  return processImage(croppedBlob)
}

/** First image file on a paste/drop DataTransfer (PrtSc, copy image). */
export function getClipboardImage(
  data: DataTransfer | null | undefined
): File | null {
  if (!data) return null
  for (const item of data.items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }
  for (const file of data.files) {
    if (file.type.startsWith('image/')) return file
  }
  return null
}

export async function blobToRecord(blob: Blob): Promise<MediaDBRecord> {
  const buffer = await blob.arrayBuffer()
  return { buffer, type: blob.type }
}

export function recordToBlob(record: MediaDBRecord): Blob {
  return new Blob([record.buffer], { type: record.type })
}

export function arrayBufferToBase64(
  record: MediaDBRecord
): Record<string, string> {
  let binary = ''
  const bytes = new Uint8Array(record.buffer)
  const len = bytes.byteLength

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  return { buffer: btoa(binary), type: record.type }
}

export function base64ToArrayBuffer({
  buffer,
  type
}: ImageBase64Record): MediaDBRecord {
  const binaryString = atob(buffer)
  const len = binaryString.length
  const bytes = new Uint8Array(len)

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return { buffer: bytes.buffer, type }
}

export function isBase64Image(record: unknown): boolean {
  return (
    typeof record === 'object' &&
    record !== null &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (record as any).buffer === 'string'
  )
}
