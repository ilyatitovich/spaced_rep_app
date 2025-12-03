import type { ImageDBRecord } from '@/types'

export async function processImage(file: File): Promise<Blob> {
  const maxWidth = 500,
    maxHeight = 700

  const img = await createImageBitmap(file)

  let width = img.width
  let height = img.height

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx!.fillStyle = 'white'
  ctx!.fillRect(0, 0, width, height)
  ctx?.drawImage(img, 0, 0, width, height)

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) return reject('Failed to convert to Webp')
        resolve(blob)
      },
      'image/webp',
      0.85
    )
  })
}

export async function blobToRecord(blob: Blob): Promise<ImageDBRecord> {
  const buffer = await blob.arrayBuffer()
  return { buffer, type: blob.type }
}

export function recordToBlob(record: ImageDBRecord): Blob {
  return new Blob([record.buffer], { type: record.type })
}

export function arrayBufferToBase64(
  record: ImageDBRecord
): Record<string, string> {
  let binary = ''
  const bytes = new Uint8Array(record.buffer)
  const len = bytes.byteLength

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  return { buffer: btoa(binary), type: record.type }
}
