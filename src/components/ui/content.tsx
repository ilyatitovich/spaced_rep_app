import type { ReactNode } from 'react'

type ContentProps = {
  children: ReactNode
  className?: string
  height?: 84 | 92 | 100
  centered?: boolean
  loading?: boolean
}

export default function Content({
  children,
  className = '',
  height = 84,
  centered = false,
  loading = false
}: ContentProps) {
  if (loading) {
    centered = true
  }

  return (
    <section
      className={`h-dvh-${height} p-4 overflow-y-auto ${className} ${centered ? 'flex items-center justify-center' : ''}`.trim()}
    >
      {loading ? <p>Loading...</p> : children}
    </section>
  )
}
