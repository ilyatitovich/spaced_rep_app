import { LogIn, LogOut } from 'lucide-react'
import Button from '@/components/ui/button'

interface PanelHeaderProps {
  isSignedIn: boolean
  isLoading: boolean
  onSignIn: () => void
  onSignOut: () => void
}

const headerButtonClassName = 'text-sm font-medium w-full flex gap-2'

export default function PanelHeader({
  isSignedIn,
  isLoading,
  onSignIn,
  onSignOut
}: PanelHeaderProps) {
  const buttonProps = isSignedIn
    ? {
        variant: 'outline' as const,
        Icon: LogOut,
        label: 'Sign out',
        onClick: onSignOut,
        disabled: false
      }
    : {
        variant: 'primary' as const,
        Icon: LogIn,
        label: 'Sign in to sync',
        onClick: onSignIn,
        disabled: isLoading
      }

  return (
    <header className="p-3 border-b border-border">
      <Button
        variant={buttonProps.variant}
        disabled={buttonProps.disabled}
        onClick={buttonProps.onClick}
        className={headerButtonClassName}
      >
        <buttonProps.Icon size={17} /> {buttonProps.label}
      </Button>
    </header>
  )
}
