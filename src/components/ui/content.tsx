import type { ReactNode } from 'react'

type ContentProps = {
  children?: ReactNode
  className?: string
}

export default function Content({ children, className }: ContentProps) {
  return (
    <section className={`content p-4 overflow-y-scroll ${className}`}>
      {children}
    </section>
  )
}
