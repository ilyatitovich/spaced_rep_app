import { Rocket } from 'lucide-react'

import { Logo } from '@/components'
import { completeOnboarding } from '@/lib'
import { useState } from 'react'
import { AuthStep } from '@/types'
import AuthMethods from '../auth/auth-methods'
import Button from '../ui/button'

type StartScreenProps = {
  onStart: () => void
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const handleStartLocalApp = () => {
    completeOnboarding()
    onStart()
  }

  const [step, setStep] = useState<AuthStep>('methods')

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="flex-1 flex flex-col pt-8 pb-12">
        <Logo />

        <AuthMethods step={step} onStepChange={setStep} />

        <div className="flex items-center my-8">
          <div className="flex-1 h-px bg-border" />
          <span className="px-4 text-foreground-subtle text-sm font-medium">
            OR
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Button
          variant="outline"
          size="lg"
          className="w-full gap-2 border-2 bg-card font-semibold hover:border-border-strong"
          onClick={handleStartLocalApp}
        >
          <Rocket size={18} />
          Start Local App
        </Button>
      </div>
    </div>
  )
}
