export function unavailable(method: string): () => Promise<never> {
  return () =>
    Promise.reject(new Error(`${method} is not available in the extension`))
}
