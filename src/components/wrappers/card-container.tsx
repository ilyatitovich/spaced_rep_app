import type { ReactNode } from 'react'

type CardContainerProps = {
  children: ReactNode
}

export default function CardContainer({ children }: CardContainerProps) {
  return (
    <div className="h-[70dvh] flex justify-center items-center">{children}</div>
  )
}
