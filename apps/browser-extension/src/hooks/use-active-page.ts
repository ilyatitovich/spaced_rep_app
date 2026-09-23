import { useEffect, useState } from 'react'

import { getActivePage, subscribeActivePage, type ActivePage } from '@ext/lib'

export function useActivePage(
  fallback?: Partial<ActivePage> | null
): ActivePage {
  const [page, setPage] = useState<ActivePage>({
    title: fallback?.title ?? '',
    url: fallback?.url ?? ''
  })

  useEffect(() => {
    let cancelled = false
    const read = async () => {
      const next = await getActivePage()
      if (cancelled) return
      setPage({
        title: next.title || fallback?.title || '',
        url: next.url || fallback?.url || ''
      })
    }
    void read()
    const unsubscribe = subscribeActivePage(() => void read())
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [fallback?.title, fallback?.url])

  return page
}
