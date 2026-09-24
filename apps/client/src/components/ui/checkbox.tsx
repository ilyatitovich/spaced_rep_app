import { Check } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'

type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'checked'
> & {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
}

export default function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className = '',
  ...rest
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-3 select-none ${
        disabled ? 'opacity-50' : 'cursor-pointer'
      } ${className}`}
    >
      <span className="relative shrink-0">
        <input
          {...rest}
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden
          className={`flex size-5 items-center justify-center rounded-sm border-2 transition-colors ${
            checked ? 'border-primary bg-primary' : 'border-border bg-white'
          } peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary`}
        >
          {checked && (
            <Check
              className="size-3.5 text-primary-foreground"
              strokeWidth={3}
            />
          )}
        </span>
      </span>
      <span className="text-sm text-foreground">{label}</span>
    </label>
  )
}
