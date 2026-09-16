const OPEN_FENCE = /^```(?:json)?\s*/i
const INNER_FENCE = /```(?:json)?\s*([\s\S]*?)\s*```/i

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(OPEN_FENCE, '')
      .replace(/\s*```$/, '')
      .trim()
  }
  const inner = INNER_FENCE.exec(trimmed)?.[1]
  return inner ? inner.trim() : trimmed
}

export function parseImportJson(text: string): unknown {
  try {
    return JSON.parse(stripMarkdownFences(text))
  } catch {
    throw new Error('Invalid JSON')
  }
}
