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
        if (!blob) return reject('Failed to convert to jpeg')
        resolve(blob)
      },
      'image/webp',
      0.85
    )
  })
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error || new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

export async function webpBlobToDataURL(blob: Blob): Promise<string> {
  const img = document.createElement('img')
  img.src = URL.createObjectURL(blob)

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject('Safari cannot load WebP')
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  // Safari гарантированно поддерживает JPEG/PNG
  return canvas.toDataURL('image/jpeg', 0.92)
}

export async function blobToRecord(blob: Blob) {
  const buffer = await blob.arrayBuffer()
  return { buffer, type: blob.type }
}

export function recordToBlob(record: { buffer: ArrayBuffer; type: string }) {
  return new Blob([record.buffer], { type: record.type })
}
