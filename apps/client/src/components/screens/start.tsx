import { Rocket } from 'lucide-react'

import { Logo, AuthMethods } from '@/components'
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
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="flex-1 flex flex-col pt-8 pb-12">
        <Logo />

        <AuthMethods />

        <div className="flex items-center my-8">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="px-4 text-slate-400 text-sm font-medium">OR</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          onClick={handleStartLocalApp}
          className="w-full bg-white border-2 border-slate-200 hover:border-slate-300 font-semibold py-4 rounded-xl text-slate-700 flex items-center justify-center gap-2 transition-all text-base"
        >
          <Rocket className="w-4 h-4" />
          Start Local App
        </button>
      </div>
    </main>
  )
}
