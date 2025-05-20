import type { ReactNode } from 'react'
import { Children, CSSProperties } from 'react'

type NavbarProps = {
  children: ReactNode | ReactNode[]
  className?: string
  ariaLabel?: string
}

export default function Navbar({
  children,
  className = '',
  ariaLabel = 'Main navigation'
}: NavbarProps) {
  const childrenArray = Children.toArray(children).slice(0, 3)
  const childrenCount = childrenArray.length

  const baseClasses = `flex items-center w-full p-4 border-b border-light-gray
    ${childrenCount === 3 ? 'relative' : ''}
  `

  const combinedClasses = `${baseClasses} ${className}`.trim()

  let justifyClass = 'justify-center'
  let childrenStyles: CSSProperties[] = []

  if (childrenCount > 1) {
    justifyClass = 'justify-between'
  }

  if (childrenCount === 3) {
    childrenStyles = [
      {},
      {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      },
      {}
    ]
  }

  return (
    <nav
      className={`${combinedClasses} ${justifyClass}`}
      aria-label={ariaLabel}
    >
      {childrenArray.map((child, index) => (
        <span key={index} style={childrenStyles[index]}>
          {child}
        </span>
      ))}
    </nav>
  )
}
