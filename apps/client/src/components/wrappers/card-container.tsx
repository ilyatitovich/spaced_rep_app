import type { ReactNode } from 'react'

interface CardContainerProps {
  children: ReactNode
  className?: string
}

export default function CardContainer({
  children,
  className = 'h-[70dvh]'
}: CardContainerProps) {
  return (
    <div className={`${className} flex justify-center items-center`}>
      {children}
    </div>
  )
}
