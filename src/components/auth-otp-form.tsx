import { ArrowLeft } from 'lucide-react'
import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useState } from 'react'

import { getAuthErrorMessage } from '@/lib'

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

type AuthOtpFormProps = {
  email: string
  onVerify: (token: string) => Promise<void>
  onResend: () => Promise<void>
  onBack: () => void
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.slice(0, 1)
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`
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

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown(seconds => Math.max(seconds - 1, 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH)
    setCode(digits)
    if (error) setError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!/^\d{6}$/.test(code)) {
      setError('Please enter the 6-digit code')
      return
    }

    setIsLoading(true)
    try {
      await onVerify(code)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return
    setError('')
    setIsResending(true)
    try {
      await onResend()
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div>
      <div className="text-center mb-6 flex flex-col gap-2">
        <p className="text-2xl font-semibold text-slate-800">Enter your code</p>
        <p className="text-sm text-gray-600">
          We sent a code to <span className="font-medium">{maskEmail(email)}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="auth-otp" className="sr-only">
            Verification code
          </label>
          <input
            id="auth-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={OTP_LENGTH}
            placeholder="123456"
            value={code}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'auth-otp-error' : undefined}
            className="w-full p-4 rounded-xl border border-gray-300 focus:border-purple-600 focus:outline-none transition text-center text-2xl tracking-[0.5em] font-medium"
          />
          {error && (
            <p
              id="auth-otp-error"
              className="text-red-600 text-sm mt-2 text-center"
            >
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-black active:bg-purple-700 font-medium py-4 rounded-xl flex items-center justify-center gap-3 transition-all text-base text-white disabled:opacity-50"
        >
          {isLoading ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Verify'
          )}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0 || isResending}
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
