import { X } from 'lucide-react'
import { useState } from 'react'

import AuthMethods from '@/components/auth/auth-methods'
import type { AuthStep } from '@/types'

import { AuthProvider } from '@ext/contexts'

export default function AuthScreen({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<AuthStep>('methods')
  return (
    <AuthProvider>
      <div className="h-full bg-background flex flex-col overflow-hidden">
        <div className="flex items-center justify-between w-full p-4 gap-2">
          <button
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-foreground rounded-full"
          >
            <X className="w-4 h-4 text-foreground-inverse" strokeWidth={4} />
          </button>
          <span className="font-bold">Sign in</span>
        </div>
        <div className="pt-4 overflow-auto">
          <AuthMethods step={step} onStepChange={setStep} onSuccess={onClose} />
        </div>
      </div>
    </AuthProvider>
  )
}
