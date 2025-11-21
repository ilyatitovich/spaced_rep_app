import { ChevronLeft, X } from 'lucide-react'
import { useSearchParams } from 'react-router'

import Button from './button'
import { removeLastSearchParam } from '@/lib'

type BackButtonProps = {
  icon?: 'chevron' | 'x'
}

export default function BackButton({ icon = 'chevron' }: BackButtonProps) {
  const [, setSearchParams] = useSearchParams()

  return (
    <Button
      onClick={() => {
        setSearchParams(prev => removeLastSearchParam(prev))
      }}
    >
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
