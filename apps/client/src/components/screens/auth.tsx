import { BackButton, Header, Screen } from '@/components'
import { useAuth } from '@/contexts'
import { AuthStep } from '@/types'
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'react-hot-toast'
import AuthMethods from '../auth/auth-methods'

type AuthScreenProps = {
  isOpen: boolean
}

export default function AuthScreen({ isOpen }: AuthScreenProps) {
  const { isConfigured } = useAuth()
  const [step, setStep] = useState<AuthStep>('methods')
  const [searchParams, setSearchParams] = useSearchParams()

  const handleClose = useCallback(() => {
    setStep('methods')
    searchParams.delete('auth')
    setSearchParams(searchParams)
  }, [searchParams, setSearchParams])

  const handleSuccess = useCallback(() => {
    toast.success('Signed in')
    handleClose()
  }, [handleClose])

  return (
    <Screen isOpen={isOpen} isVertical onClose={handleClose}>
      <div className="h-full bg-background flex flex-col overflow-hidden">
        <Header>
          <BackButton />
          <span className="font-bold">Sign in</span>
        </Header>
        <div className="pt-4">
          {isConfigured ? (
            <AuthMethods
              step={step}
              onStepChange={setStep}
              onSuccess={handleSuccess}
            />
          ) : (
            <p className="text-center text-foreground-muted px-4">
              Cloud sync is not configured for this build.
            </p>
          )}
        </div>
      </div>
    </Screen>
  )
}
