import type { ReactNode, HTMLAttributes } from 'react'
import { Link } from 'react-router'

type ButtonProps = HTMLAttributes<HTMLButtonElement | HTMLAnchorElement> & {
  href?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  children: ReactNode
  className?: string
  ariaLabel?: string
}

export default function Button({
  href,
  type = 'button',
  disabled = false,
  children,
  className = '',
  ariaLabel,
  ...props
}: ButtonProps) {
  const baseClasses = `
    inline-flex items-center justify-center
    font-medium focus:outline-blue focus:outline-offset-6
    ${disabled ? 'text-light-gray cursor-not-allowed' : 'hover:bg-opacity-90'}
    bg-transparent text-blue
  `

  const combinedClasses = `${baseClasses} ${className}`.trim()

  const commonProps = {
    'aria-label': ariaLabel,
    'aria-disabled': disabled ? true : undefined,
    ...props
  }

  if (href && !disabled) {
    return (
      <Link
        to={href}
        className={combinedClasses}
        rel="noopener noreferrer"
        {...commonProps}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={combinedClasses}
      {...commonProps}
    >
      {children}
    </button>
  )
}
