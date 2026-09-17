import { useEffect, useRef, useState } from 'react'
import AuthMethods from '@/components/auth/auth-methods'
import { Logo, Spinner } from '@/components'
import { useAuth } from '@/contexts'
import { createExtensionGrant } from '@/lib/api'
import type { AuthStep } from '@/types'

export default function ExtensionAuthorizePage() {
  const { session, isConfigured } = useAuth()
  const [step, setStep] = useState<AuthStep>('methods')
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (!session || started.current) return
    started.current = true
    const params = new URLSearchParams(window.location.search)
    const redirectUri = params.get('redirect_uri') ?? ''
    const state = params.get('state') ?? ''
    const codeChallenge = params.get('code_challenge') ?? ''
    void createExtensionGrant(session.accessToken, {
      redirectUri,
      state,
      codeChallenge
    })
      .then(grant => {
        const callback = new URL(redirectUri)
        callback.searchParams.set('code', grant.code)
        callback.searchParams.set('state', grant.state)
        window.location.replace(callback)
      })
      .catch(reason => {
        started.current = false
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not authorize the extension'
        )
      })
  }, [session])

  return (
    <main className="min-h-dvh bg-background flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-md">
        <Logo />
        {error && (
          <p className="text-danger text-center text-sm px-4 mb-4">{error}</p>
        )}
        {session ? (
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-foreground-muted">Authorizing extension…</p>
          </div>
        ) : isConfigured ? (
          <AuthMethods step={step} onStepChange={setStep} />
        ) : (
          <p className="text-center text-foreground-muted">
            Cloud authentication is not configured.
          </p>
        )}
      </div>
    </main>
  )
}
