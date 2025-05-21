import type { ReactNode } from 'react'

type ContentProps = {
  children: ReactNode
  className?: string
  height?: 84 | 92 | 100
}

export default function Content({
  children,
  className,
  height = 84
}: ContentProps) {
  return (
    <section className={`h-dvh-${height} p-4 overflow-y-scroll ${className}`}>
      {children}
    </section>
  )
}
