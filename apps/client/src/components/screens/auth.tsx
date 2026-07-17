import { AuthMethods, BackButton, Header, Screen } from '@/components'
import { AuthStep } from '@/types'
import { useCallback, useState } from 'react'

type AuthScreenProps = {
  isOpen: boolean
}

export default function AuthScreen({ isOpen }: AuthScreenProps) {
  const [step, setStep] = useState<AuthStep>('methods')

  const handleClose = useCallback(() => {
    setStep('methods')
  }, [])

  return (
    <Screen isOpen={isOpen} isVertical onClose={handleClose}>
      <div className="h-full bg-background flex flex-col overflow-hidden">
        <Header>
          <BackButton />
          <span className="font-bold">Sign in</span>
        </Header>
        <div className="flex flex-col items-center justify-center h-full w-full">
          <AuthMethods step={step} onStepChange={setStep} />
        </div>
      </div>
    </Screen>
  )
}
