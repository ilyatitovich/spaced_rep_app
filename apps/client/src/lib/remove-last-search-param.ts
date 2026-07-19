export function removeLastSearchParam(prev: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(prev)

  const keys = Array.from(params.keys())
  if (keys.length === 0) return params

  const lastKey = keys[keys.length - 1]
  params.delete(lastKey)

  return params
}
