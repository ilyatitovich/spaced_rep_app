import { KeyRound, Mail } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

import AuthEmailForm from './auth-email-form'
import AuthOtpForm from './auth-otp-form'
import { GoogleIcon } from './ui/icons/google'
import { useAuth } from '@/contexts'

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
}

function AuthMethodButton({
  icon,
  label,
  onClick,
  isLastUsed
}: AuthMethodButtonProps) {
  return (
    <div className="relative">
      {isLastUsed && (
        <span className="absolute -top-2 right-4 px-2 py-0.5 text-[10px] font-medium bg-purple-600 text-white rounded-full">
          Last Used
        </span>
      )}
      <button
        onClick={onClick}
        className={
          isLastUsed
            ? 'w-full bg-black active:bg-purple-700 font-medium py-4 rounded-xl flex items-center justify-center gap-3 transition-all text-base text-white'
            : 'w-full border border-slate-300 active:bg-slate-100 font-medium py-4 rounded-xl flex items-center justify-center gap-3 transition-all text-base text-slate-700'
        }
      >
        {icon}
        {label}
      </button>
    </div>
  )
}

type AuthStep = 'methods' | 'email' | 'otp'

export default function AuthMethods() {
  // Lazy init: read synchronously on first render so the reorder happens
  // before paint, not after (avoids a visible button jump on mount).
  const [lastUsed] = useState<AuthMethodId | null>(getLastUsedAuthMethod)
  const [step, setStep] = useState<AuthStep>('methods')
  const [pendingEmail, setPendingEmail] = useState('')
  const { signInWithGoogle, sendEmailOtp, verifyEmailOtp } = useAuth()

  const handleGoogle = () => {
    setLastUsedAuthMethod('google')
    void signInWithGoogle().catch(err => {
      toast.error(
        err instanceof Error ? err.message : 'Google sign-in failed.'
      )
    })
  }

  const handleEmail = () => {
    setLastUsedAuthMethod('email')
    setStep('email')
  }

  const handlePasskey = () => {
    setLastUsedAuthMethod('passkey')
  }

  const handleSendOtp = async (email: string) => {
    await sendEmailOtp(email)
    setPendingEmail(email)
    setStep('otp')
    toast.success('Check your email for a code')
  }

  const handleVerifyOtp = async (token: string) => {
    await verifyEmailOtp(pendingEmail, token)
    setStep('methods')
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
        onBack={() => setStep('methods')}
      />
    )
  }

  if (step === 'otp') {
    return (
      <AuthOtpForm
        email={pendingEmail}
        onVerify={handleVerifyOtp}
        onResend={() => sendEmailOtp(pendingEmail)}
        onBack={() => setStep('email')}
      />
    )
  }

  return (
    <div>
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
