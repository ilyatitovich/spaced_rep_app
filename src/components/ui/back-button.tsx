import { ChevronLeft, X } from 'lucide-react'

import Button from './button'
import { useScreenStore } from '@/stores'

type BackButtonProps = {
  icon?: 'chevron' | 'x'
}

export default function BackButton({ icon = 'chevron' }: BackButtonProps) {
  return (
    <Button onClick={useScreenStore.getState().closeScreen}>
      {icon === 'chevron' ? (
        <ChevronLeft size={28} />
      ) : (
        <div className="w-8 h-8 flex items-center justify-center bg-black rounded-full">
          <X className="w-4 h-4 text-white" strokeWidth={4} />
        </div>
      )}
    </Button>
  )
}
