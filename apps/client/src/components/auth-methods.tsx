import { KeyRound, Mail, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'

import AuthEmailForm from './auth-email-form'
import AuthOtpForm from './auth-otp-form'
import { GoogleIcon } from './ui/icons/google'
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

function setLastUsedAuthMethod(id: AuthMethodId) {
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
        <span className="absolute -top-2 right-4 px-2 py-0.5 text-[10px] font-medium bg-purple-600 text-white rounded-full">
          Last Used
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        className={
          isLastUsed
            ? 'w-full bg-black active:bg-purple-700 font-medium py-4 rounded-xl flex items-center justify-center gap-3 transition-all text-base text-white disabled:opacity-50'
            : 'w-full border border-slate-300 active:bg-slate-100 font-medium py-4 rounded-xl flex items-center justify-center gap-3 transition-all text-base text-slate-700 disabled:opacity-50'
        }
      >
        {icon}
        {isLoading ? 'Waiting…' : label}
      </button>
    </div>
  )
}

type AuthMethodsProps = {
  step: AuthStep
  onStepChange: (step: AuthStep) => void
}

export default function AuthMethods({ step, onStepChange }: AuthMethodsProps) {
  // Lazy init: read synchronously on first render so the reorder happens
  // before paint, not after (avoids a visible button jump on mount).
  const [lastUsed] = useState<AuthMethodId | null>(getLastUsedAuthMethod)

  const [pendingEmail, setPendingEmail] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeysSupported] = useState(() => browserSupportsWebAuthn())
  const { signInWithGoogle, signInWithPasskey, sendEmailOtp, verifyEmailOtp } =
    useAuth()

  const handleGoogle = () => {
    setLastUsedAuthMethod('google')
    void signInWithGoogle().catch(err => {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed.')
    })
  }

  const handleEmail = () => {
    setLastUsedAuthMethod('email')
    onStepChange('email')
  }

  const handlePasskey = () => {
    if (!passkeysSupported) {
      toast('Passkeys aren’t supported in this browser', {
        icon: <TriangleAlert className="text-yellow-600" size={20} />
      })
      return
    }

    setLastUsedAuthMethod('passkey')
    setPasskeyLoading(true)
    void signInWithPasskey()
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
  }

  const handleResendOtp = async (turnstileToken: string) => {
    await sendEmailOtp(pendingEmail, turnstileToken)
    toast.success('Check your email for a code')
  }

  const methods: {
    id: AuthMethodId
    render: (isLastUsed: boolean) => React.ReactNode
  }[] = [
    {
      id: 'google',
      render: isLastUsed => (
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
      render: isLastUsed => (
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
      render: isLastUsed => (
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

  const orderedMethods = lastUsed
    ? [
        methods.find(m => m.id === lastUsed)!,
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
        <p className="text-2xl font-semibold text-slate-800">
          Login to SpacedRepApp
        </p>
        <p className="text-sm text-gray-600">
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
