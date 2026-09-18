import {
  Component,
  cloneElement,
  isValidElement,
  type ErrorInfo,
  type ReactElement,
  type ReactNode
} from 'react'

import { Button } from '@/components/ui'

export interface ErrorFallbackProps {
  error?: unknown
  onRetry?: () => void
}

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const isDev = import.meta.env.DEV
  const message = error instanceof Error ? error.message : undefined
  const stack = error instanceof Error ? error.stack : undefined

  return (
    <main>
      <div className="h-dvh flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="font-bold text-2xl">Something went wrong</h1>
        {isDev && message ? <p className="text-foreground-subtle text-center">{message}</p> : null}
        {isDev && stack ? (
          <pre className="max-w-full overflow-auto text-xs text-foreground-subtle">
            <code>{stack}</code>
          </pre>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-4">
          {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
          <a className="text-primary font-medium" href="/">
            Go home
          </a>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    </main>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
  resetKey?: unknown
}

interface ErrorBoundaryState {
  hasError: boolean
  error: unknown
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null })
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  override render() {
    if (!this.state.hasError) return this.props.children

    const { fallback } = this.props
    if (isValidElement(fallback)) {
      return cloneElement(fallback as ReactElement<ErrorFallbackProps>, {
        onRetry: this.handleRetry,
        error: this.state.error
      })
    }

    return fallback
  }
}
