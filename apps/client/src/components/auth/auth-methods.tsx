import { KeyRound, Mail, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'

import AuthEmailForm from './auth-email-form'
import AuthOtpForm from './auth-otp-form'
import { GoogleIcon } from '../ui/icons/google'
import Button from '../ui/button'
import { useAuth } from '@/contexts'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { AuthStep } from '@/types'

type AuthMethodId = 'google' | 'email' | 'passkey'

const LAST_USED_KEY = 'lastUsedAuthMethod'

function getLastUsedAuthMethod(): AuthMethodId | null {
  const value = localStorage.getItem(LAST_USED_KEY)
  return value === 'google' || value === 'email' || value === 'passkey'
    ? value
    : null
}

function persistLastUsedAuthMethod(id: AuthMethodId) {
  localStorage.setItem(LAST_USED_KEY, id)
}

type AuthMethodButtonProps = {
  icon: React.ReactNode
  label: string
  onClick: () => void
  isLastUsed: boolean
  disabled?: boolean
  isLoading?: boolean
}

function AuthMethodButton({
  icon,
  label,
  onClick,
  isLastUsed,
  disabled,
  isLoading
}: AuthMethodButtonProps) {
  return (
    <div className="relative">
      {isLastUsed && (
        <span className="absolute -top-2 right-4 px-2 py-0.5 text-[10px] font-medium bg-primary text-primary-foreground rounded-full">
          Last Used
        </span>
      )}
      <Button
        variant={isLastUsed ? 'foreground' : 'outline'}
        size="lg"
        className="w-full gap-3"
        onClick={onClick}
        disabled={disabled || isLoading}
      >
        {icon}
        {isLoading ? 'Waiting…' : label}
      </Button>
    </div>
  )
}

type AuthMethodsProps = {
  step: AuthStep
  onStepChange: (step: AuthStep) => void
  onSuccess?: () => void
}

export default function AuthMethods({
  step,
  onStepChange,
  onSuccess
}: AuthMethodsProps) {
  const [lastUsed, setLastUsed] = useState<AuthMethodId | null>(
    getLastUsedAuthMethod
  )

  const [pendingEmail, setPendingEmail] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeysSupported] = useState(() => browserSupportsWebAuthn())
  const {
    signInWithGoogle,
    signInWithPasskey,
    sendEmailOtp,
    verifyEmailOtp,
    capabilities
  } = useAuth()

  const markLastUsed = (id: AuthMethodId) => {
    persistLastUsedAuthMethod(id)
    setLastUsed(id)
  }

  const handleGoogle = () => {
    // Persist before redirect so the badge is correct on return.
    markLastUsed('google')
    void signInWithGoogle().catch(err => {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed.')
    })
  }

  const handleEmail = () => {
    onStepChange('email')
  }

  const handlePasskey = () => {
    if (!passkeysSupported) {
      toast('Passkeys aren’t supported in this browser', {
        icon: <TriangleAlert className="text-warning" size={20} />
      })
      return
    }

    setPasskeyLoading(true)
    void signInWithPasskey()
      .then(() => {
        markLastUsed('passkey')
        onSuccess?.()
      })
      .catch(err => {
        toast.error(getAuthErrorMessage(err))
      })
      .finally(() => {
        setPasskeyLoading(false)
      })
  }

  const handleSendOtp = async (email: string, turnstileToken: string) => {
    await sendEmailOtp(email, turnstileToken)
    setPendingEmail(email)

    toast.success('Check your email for a code')
    onStepChange('otp')
  }

  const handleVerifyOtp = async (token: string) => {
    await verifyEmailOtp(pendingEmail, token)
    markLastUsed('email')
    onSuccess?.()
  }

  const handleResendOtp = async (turnstileToken: string) => {
    await sendEmailOtp(pendingEmail, turnstileToken)
    toast.success('Check your email for a code')
  }

  const allMethods: {
    id: AuthMethodId
    enabled: boolean
    render: (isLastUsed: boolean) => React.ReactNode
  }[] = [
    {
      id: 'google',
      enabled: capabilities.google,
      render: (isLastUsed: boolean) => (
        <AuthMethodButton
          icon={<GoogleIcon />}
          label="Continue with Google"
          onClick={handleGoogle}
          isLastUsed={isLastUsed}
        />
      )
    },
    {
      id: 'email',
      enabled: capabilities.emailOtp,
      render: (isLastUsed: boolean) => (
        <AuthMethodButton
          icon={<Mail className="w-4 h-4" />}
          label="Continue with Email"
          onClick={handleEmail}
          isLastUsed={isLastUsed}
        />
      )
    },
    {
      id: 'passkey',
      enabled: capabilities.passkey,
      render: (isLastUsed: boolean) => (
        <AuthMethodButton
          icon={<KeyRound className="w-4 h-4" />}
          label="Sign in with Passkey"
          onClick={handlePasskey}
          isLastUsed={isLastUsed}
          disabled={!passkeysSupported}
          isLoading={passkeyLoading}
        />
      )
    }
  ]

  const methods = allMethods.filter(m => m.enabled)

  const orderedMethods = lastUsed
    ? [
        ...methods.filter(m => m.id === lastUsed),
        ...methods.filter(m => m.id !== lastUsed)
      ]
    : methods

  if (step === 'email') {
    return (
      <AuthEmailForm
        onSubmit={handleSendOtp}
        onBack={() => onStepChange('methods')}
      />
    )
  }

  if (step === 'otp') {
    return (
      <AuthOtpForm
        email={pendingEmail}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        onBack={() => onStepChange('email')}
      />
    )
  }

  return (
    <div className="w-full px-4">
      <div className="text-center mb-6 flex flex-col gap-2">
        <p className="text-2xl font-semibold text-foreground">
          Login to SpacedRepApp
        </p>
        <p className="text-sm text-foreground-muted">
          Sync your topics and flashcards across devices
        </p>
      </div>

      <div className="space-y-4">
        {orderedMethods.map(method => (
          <div key={method.id}>{method.render(method.id === lastUsed)}</div>
        ))}
      </div>
    </div>
  )
}
