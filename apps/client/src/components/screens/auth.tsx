import { BackButton, Header, Screen } from '@/components'
import { AuthStep } from '@/types'
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'react-hot-toast'
import AuthMethods from '../auth/auth-methods'

type AuthScreenProps = {
  isOpen: boolean
}

export default function AuthScreen({ isOpen }: AuthScreenProps) {
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
          <AuthMethods
            step={step}
            onStepChange={setStep}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    </Screen>
  )
}
