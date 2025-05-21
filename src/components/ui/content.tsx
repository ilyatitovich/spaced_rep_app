import type { ReactNode } from 'react'

type ContentProps = {
  children?: ReactNode
  className?: string
}

export default function Content({ children, className }: ContentProps) {
  return (
    <section className={`h-dvh-84 p-4 overflow-y-scroll ${className}`}>
      {children}
    </section>
  )
}
