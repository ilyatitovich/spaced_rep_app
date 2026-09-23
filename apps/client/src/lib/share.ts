export function downloadFile(file: File): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(file)
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

// Android Chrome rejects .json and names containing : or / (ISO timestamps, titles).
function shareableFile(file: File): File {
  const name = file.name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\.{2,}/g, '.')
    .trim()
  const json = file.type === 'application/json' || /\.json$/i.test(name)
  if (!json && name === file.name) return file
  const base = (json ? name.replace(/\.json$/i, '') : name) || 'share'
  return new File([file], json ? `${base}.txt` : base, {
    type: json ? 'text/plain' : file.type
  })
}

export async function shareFile(
  file: File,
  title?: string,
  text?: string
): Promise<void> {
  const share = shareableFile(file)
  if (navigator.canShare?.({ files: [share] })) {
    try {
      await navigator.share({ files: [share], title, text })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        throw error
    }
  }
  downloadFile(file)
}

export function getJsonFile(data: unknown, fileName: string): File {
  return new File([JSON.stringify(data, null, 2)], fileName, {
    type: 'application/json'
  })
}
