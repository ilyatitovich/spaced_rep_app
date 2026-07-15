import type { ReactNode, HTMLAttributes } from 'react'

type ButtonProps = HTMLAttributes<HTMLButtonElement> & {
  disabled?: boolean
  children: ReactNode
  className?: string
  ariaLabel?: string
}

export default function Button({
  disabled = false,
  children,
  className = '',
  ariaLabel,
  ...props
}: ButtonProps) {
  const baseClasses = `
    inline-flex items-center justify-center
    font-medium ${disabled ? 'text-gray-200 cursor-not-allowed' : 'text-purple-600'}
    bg-transparent
  `

  const combinedClasses = `${baseClasses} ${className}`.trim()

  const commonProps = {
    'aria-label': ariaLabel,
    'aria-disabled': disabled ? true : undefined,
    ...props
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={combinedClasses}
      {...commonProps}
    >
      {children}
    </button>
  )
}
