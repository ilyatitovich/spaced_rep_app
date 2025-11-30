export function isContentEmpty(
  content: string | Blob | null | undefined
): boolean {
  if (content == null) return true

  // String case
  if (typeof content === 'string') {
    // Remove whitespace, tabs, newlines, invisible characters
    return content.trim().length === 0
  }

  // Blob or File case
  if (content instanceof Blob) {
    return content.size === 0
  }

  // Fallback → treat unknown types as empty
  return true
}
