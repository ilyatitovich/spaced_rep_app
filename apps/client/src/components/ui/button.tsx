import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant =
  | 'ghost'
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'dangerSoft'
  | 'dangerLink'
  | 'outline'
  | 'foreground'
  | 'link'
  | 'muted'
  | 'icon'
  | 'unstyled'

export type ButtonSize = 'none' | 'sm' | 'md' | 'lg' | 'icon' | 'fab'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  ariaLabel?: string
  children?: ReactNode
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  ghost:
    'inline-flex items-center justify-center font-medium bg-transparent text-primary disabled:text-foreground-subtle disabled:cursor-not-allowed',
  primary:
    'inline-flex items-center justify-center font-medium bg-primary text-primary-foreground disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center bg-secondary text-foreground disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center font-medium bg-danger text-danger-foreground disabled:opacity-50',
  dangerSoft:
    'inline-flex items-center justify-center bg-secondary text-danger disabled:opacity-50',
  dangerLink:
    'inline-flex items-center justify-center font-medium text-danger disabled:text-foreground-subtle disabled:cursor-not-allowed',
  outline:
    'inline-flex items-center justify-center font-medium border border-border bg-transparent text-foreground disabled:opacity-50',
  foreground:
    'inline-flex items-center justify-center font-medium bg-foreground text-background active:bg-primary disabled:opacity-50',
  link: 'inline-flex items-center justify-center font-medium text-primary disabled:opacity-50',
  muted:
    'inline-flex items-center justify-center font-medium text-foreground-muted active:text-foreground disabled:text-foreground-subtle',
  icon: 'inline-flex items-center justify-center text-foreground-muted disabled:opacity-50',
  unstyled: ''
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  none: '',
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-3 rounded-xl active:scale-95',
  lg: 'px-4 py-4 text-base rounded-xl',
  icon: 'p-1',
  fab: 'w-14 h-14 rounded-full shadow-lg active:scale-90'
}

const DEFAULT_SIZE: Record<ButtonVariant, ButtonSize> = {
  ghost: 'none',
  primary: 'md',
  secondary: 'md',
  danger: 'md',
  dangerSoft: 'md',
  dangerLink: 'none',
  outline: 'md',
  foreground: 'lg',
  link: 'none',
  muted: 'none',
  icon: 'icon',
  unstyled: 'none'
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export default function Button({
  variant = 'ghost',
  size,
  disabled = false,
  children,
  className = '',
  ariaLabel,
  type = 'button',
  ...props
}: ButtonProps) {
  const resolvedSize = size ?? DEFAULT_SIZE[variant]

  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      aria-label={ariaLabel ?? props['aria-label']}
      aria-disabled={disabled || undefined}
      className={cx(
        VARIANT_CLASS[variant],
        SIZE_CLASS[resolvedSize],
        className
      )}
    >
      {children}
    </button>
  )
}
