import { ArrowLeft } from 'lucide-react'
import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'

import { getAuthErrorMessage, validateEmail } from '@/lib'

type AuthEmailFormProps = {
  onSubmit: (email: string) => Promise<void>
  onBack: () => void
}

export default function AuthEmailForm({
  onSubmit,
  onBack
}: AuthEmailFormProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (error) setError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const result = validateEmail(email)
    if (!result.ok) {
      setError(result.message)
      return
    }

    setIsLoading(true)
    try {
      await onSubmit(result.email)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="text-center mb-6 flex flex-col gap-2">
        <p className="text-2xl font-semibold text-slate-800">
          Sign in with Email
        </p>
        <p className="text-sm text-gray-600">
          Enter your email and we&apos;ll send you a login code
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="auth-email" className="sr-only">
            Email address
          </label>
          <input
            id="auth-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'auth-email-error' : undefined}
            className="w-full p-4 rounded-xl border border-gray-300 focus:border-purple-600 focus:outline-none transition"
          />
          {error && (
            <p
              id="auth-email-error"
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
            'Send code'
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="w-full mt-4 py-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-500 active:text-slate-700 transition-colors"
      >
        Choose another method
      </button>
    </div>
  )
}
