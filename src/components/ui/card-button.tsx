import { RefreshCw } from 'lucide-react'
import type { ElementType } from 'react'

type CardButtonProps = {
  type: 'flip' | 'shortText' | 'longText' | 'image' | 'code'
  onClick: () => void
}

export default function CardButton({ type, onClick }: CardButtonProps) {
  let Icon: ElementType | null = null
  let label = ''

  switch (type) {
    case 'flip':
      Icon = RefreshCw
      label = 'Flip'
      break

    case 'shortText':
      return null
    case 'longText':
      return null
    case 'image':
      return null
    case 'code':
      return null

    default:
      return null
  }

  if (!Icon) return null

  return (
    <button
      onClick={onClick}
      className="flex flex-col justify-center items-center gap-1"
    >
      <span className="w-8 h-8 flex justify-center items-center border-2 rounded-full">
        <Icon className="w-4 h-4 text-black" strokeWidth={3} />
      </span>
      <span className="text-black text-sm font-semibold">{label}</span>
    </button>
  )
}
