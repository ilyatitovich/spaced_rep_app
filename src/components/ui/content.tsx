import type { ReactNode } from 'react'

type ContentProps = {
  children: ReactNode
  className?: string
  height?: 84 | 92 | 100
  centered?: boolean
}

export default function Content({
  children,
  className = '',
  height = 84,
  centered = false
}: ContentProps) {
  return (
    <section
      className={`h-dvh-${height} p-4 overflow-y-scroll ${className} ${centered ? 'flex items-center justify-center' : ''}`.trim()}
    >
      {children}
    </section>
  )
}
