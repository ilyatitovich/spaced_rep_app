import type { ReactNode } from 'react'
import { Children, CSSProperties } from 'react'

type HeaderProps = {
  children: ReactNode | ReactNode[]
  className?: string
}

export default function Header({ children, className = '' }: HeaderProps) {
  const childrenArray = Children.toArray(children).slice(0, 3)
  const childrenCount = childrenArray.length

  const baseClasses = `flex items-center w-full p-4
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
        transform: 'translate(-50%, -50%)',
        maxWidth: '160px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: 'center',
        fontWeight: 'bold'
      },
      {}
    ]
  }

  return (
    <div className={`${combinedClasses} ${justifyClass}`}>
      {childrenArray.map((child, index) => (
        <span key={index} style={childrenStyles[index]}>
          {child}
        </span>
      ))}
    </div>
  )
}
