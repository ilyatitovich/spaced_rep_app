import { Rocket } from 'lucide-react'

import {
  Logo
  // AuthMethods
} from '@/components'
import { completeOnboarding } from '@/lib'

type StartScreenProps = {
  onStart: () => void
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const handleStartLocalApp = () => {
    completeOnboarding()
    onStart()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="flex-1 flex flex-col pt-8 pb-12">
        <Logo />

        {/* <AuthMethods /> */}

        <div className="flex items-center my-8">
          <div className="flex-1 h-px bg-border" />
          <span className="px-4 text-foreground-subtle text-sm font-medium">
            OR
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleStartLocalApp}
          className="w-full bg-card border-2 border-border hover:border-border-strong font-semibold py-4 rounded-xl text-foreground flex items-center justify-center gap-2 transition-all text-base"
        >
          <Rocket size={18} />
          Start Local App
        </button>
      </div>
    </div>
  )
}
