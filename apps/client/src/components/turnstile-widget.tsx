import { useEffect, useRef, useState } from 'react'

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (
    el: HTMLElement,
      options: {
      sitekey: string
      size?: 'normal' | 'compact' | 'flexible' | 'invisible'
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    }
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  const existing = document.getElementById(SCRIPT_ID)
  if (existing) {
    return new Promise(resolve => {
      existing.addEventListener('load', () => resolve(), { once: true })
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Turnstile'))
    document.head.appendChild(script)
  })
}

type TurnstileWidgetProps = {
  onToken: (token: string | null) => void
}

export default function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  const [error, setError] = useState('')

  onTokenRef.current = onToken

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    let cancelled = false

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          size: 'invisible',
          callback: token => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => {
            onTokenRef.current(null)
            setError('Bot verification failed. Please try again.')
          }
        })
      })
      .catch(() => {
        if (!cancelled) setError('Bot verification unavailable.')
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey])

  if (!siteKey) {
    return (
      <p className="text-red-600 text-sm text-center">
        Turnstile is not configured.
      </p>
    )
  }

  return (
    <>
      <div ref={containerRef} className="hidden" aria-hidden="true" />
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </>
  )
}
