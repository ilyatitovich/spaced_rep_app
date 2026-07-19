import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export function SettingsGroup({
  label,
  children,
  footer
}: {
  label?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          {label}
        </span>
      )}
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        {children}
      </div>
      {footer && <p className="px-1 text-xs text-foreground-muted">{footer}</p>}
    </div>
  )
}

export function SettingsNavRow({
  icon,
  label,
  value,
  onClick,
  disabled = false,
  destructive = false
}: {
  icon?: ReactNode
  label: string
  value?: string
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-50 ${
        destructive ? 'text-danger' : ''
      }`}
    >
      {icon && (
        <span className="shrink-0 text-foreground-muted [&_svg]:w-[18px] [&_svg]:h-[18px]">
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0 font-medium">{label}</span>
      {value && (
        <span className="shrink-0 text-sm text-foreground-muted truncate max-w-[40%]">
          {value}
        </span>
      )}
      {onClick && !disabled && (
        <ChevronRight size={18} className="shrink-0 text-foreground-subtle" />
      )}
    </button>
  )
}

export function SettingsToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      className={`flex items-center gap-3 px-4 py-3.5 ${
        disabled ? 'opacity-50' : 'cursor-pointer'
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className="font-medium block">{label}</span>
        {description && (
          <span className="text-xs text-foreground-muted block mt-0.5">
            {description}
          </span>
        )}
      </div>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="settings-switch shrink-0"
      />
    </label>
  )
}

export function SettingsSelectRow({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label
      className={`flex items-center gap-3 px-4 py-3.5 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <span className="flex-1 font-medium">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="text-sm text-foreground-muted bg-transparent border-0 outline-none max-w-[55%] text-right appearance-none"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SettingsSegmentedRow({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5">
      <span className="font-medium">{label}</span>
      <div className="flex rounded-lg border border-border overflow-hidden">
        {options.map(opt => {
          const selected = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-foreground-muted'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SettingsActionRow({
  icon,
  label,
  onClick,
  disabled = false,
  destructive = false
}: {
  icon?: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 font-medium disabled:opacity-50 ${
        destructive ? 'text-danger' : 'text-primary'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function SettingsInfoRow({
  label,
  value
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex-1 text-foreground-muted">{label}</span>
      <span className="text-sm font-medium text-right max-w-[55%] truncate">
        {value}
      </span>
    </div>
  )
}
