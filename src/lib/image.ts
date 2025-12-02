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
        if (!blob) return reject('Failed to convert to WebP')
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
