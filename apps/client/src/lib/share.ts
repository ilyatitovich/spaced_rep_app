export async function shareFile(
  file: File,
  title?: string,
  text?: string
): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title,
      text
    })
  } else {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(file)
    link.download = file.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }
}

export function getJsonFile(data: unknown, fileName: string): File {
  return new File([JSON.stringify(data, null, 2)], fileName, {
    type: 'application/json'
  })
}
