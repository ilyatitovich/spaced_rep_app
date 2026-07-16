import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import TurnstileWidget from './turnstile-widget'
import { getAuthErrorMessage } from '@/lib'
import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from 'input-otp'

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

type AuthOtpFormProps = {
  email: string
  onVerify: (token: string) => Promise<void>
  onResend: (turnstileToken: string) => Promise<void>
  onBack: () => void
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.slice(0, 1)
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`
}

function OtpSlot({ char, isActive, hasFakeCaret }: SlotProps) {
  return (
    <div
      className={`relative w-11 h-14 flex items-center justify-center rounded-xl border text-2xl font-medium transition ${
        isActive ? 'border-purple-600' : 'border-gray-300'
      }`}
    >
      {char}
      {hasFakeCaret && (
        <div className="absolute w-px h-6 bg-purple-600 animate-pulse" />
      )}
    </div>
  )
}

export default function AuthOtpForm({
  email,
  onVerify,
  onResend,
  onBack
}: AuthOtpFormProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown(seconds => Math.max(seconds - 1, 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleChange = (value: string) => {
    setCode(value)
    if (error) setError('')
  }

  const handleComplete = async (value: string) => {
    if (isLoading) return
    setError('')
    setIsLoading(true)
    try {
      await onVerify(value)
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setCode('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return
    if (!turnstileToken) {
      setError('Please complete the bot check before resending.')
      return
    }
    setError('')
    setIsResending(true)
    try {
      await onResend(turnstileToken)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      setTurnstileToken(null)
      setTurnstileKey(key => key + 1)
      setCode('')
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setTurnstileToken(null)
      setTurnstileKey(key => key + 1)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div>
      <div className="text-center mb-6 flex flex-col gap-2">
        <p className="text-2xl font-semibold text-slate-800">Enter your code</p>
        <p className="text-sm text-gray-600">
          We sent a code to{' '}
          <span className="font-medium">{maskEmail(email)}</span>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="auth-otp" className="sr-only">
            Verification code
          </label>
          <OTPInput
            id="auth-otp"
            maxLength={OTP_LENGTH}
            value={code}
            onChange={handleChange}
            onComplete={handleComplete}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoFocus
            disabled={isLoading}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'auth-otp-error' : undefined}
            containerClassName="flex justify-center gap-2 has-[:disabled]:opacity-50"
            render={({ slots }) => (
              <>
                {slots.map((slot, idx) => (
                  <OtpSlot key={idx} {...slot} />
                ))}
              </>
            )}
          />
          {isLoading && (
            <p className="text-sm text-gray-500 mt-3 text-center flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              Verifying...
            </p>
          )}
          {error && !isLoading && (
            <p
              id="auth-otp-error"
              className="text-red-600 text-sm mt-3 text-center"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        {resendCooldown <= 0 && (
          <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} />
        )}
        <button
          type="button"
          onClick={handleResend}
          disabled={
            resendCooldown > 0 ||
            isResending ||
            (resendCooldown <= 0 && !turnstileToken)
          }
          className="text-sm font-medium text-purple-600 active:text-purple-700 transition-colors disabled:text-slate-400"
        >
          {resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : isResending
              ? 'Sending...'
              : 'Resend code'}
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="w-full mt-4 py-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-500 active:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Change email
      </button>
    </div>
  )
}
