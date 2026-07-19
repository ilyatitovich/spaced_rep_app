import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-hot-toast'

import { Spinner } from '@/components'
import { useAuth } from '@/contexts'
import { exchangeGoogleCode } from '@/lib/api'
import {
  clearPkcePending,
  getPkcePending,
  type AuthSession
} from '@/lib/auth-storage'
import { googleRedirectUri } from '@/lib/pkce'

let loginOnce: Promise<AuthSession> | null = null

export default function OAuthGoogleCallbackPage() {
  const navigate = useNavigate()
  const { completeGoogleLogin } = useAuth()
  const [message, setMessage] = useState('Signing you in…')

  useEffect(() => {
    let cancelled = false

    async function run() {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      const errorDescription = params.get('error_description')

      if (error) {
        const text =
          error === 'access_denied'
            ? 'Google sign-in was cancelled.'
            : errorDescription || 'Google sign-in failed.'
        if (!cancelled) {
          setMessage(text)
          toast.error(text)
          navigate('/', { replace: true })
        }
        return
      }

      try {
        if (!loginOnce) {
          const code = params.get('code')
          const state = params.get('state')
          const pending = getPkcePending()

          if (!code || !state || !pending || pending.state !== state) {
            throw new Error('Invalid or expired Google sign-in state.')
          }

          loginOnce = exchangeGoogleCode({
            code,
            codeVerifier: pending.codeVerifier,
            redirectUri: googleRedirectUri()
          }).finally(() => {
            clearPkcePending()
          })
        }

        const session = await loginOnce
        if (cancelled) return
        completeGoogleLogin(session)
        navigate('/', { replace: true })
      } catch (err) {
        loginOnce = null
        const text =
          err instanceof Error ? err.message : 'Google sign-in failed.'
        if (!cancelled) {
          setMessage(text)
          toast.error(text)
          navigate('/', { replace: true })
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [completeGoogleLogin, navigate])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-4">
      <Spinner />
      <p className="text-sm text-foreground-muted">{message}</p>
    </div>
  )
}
