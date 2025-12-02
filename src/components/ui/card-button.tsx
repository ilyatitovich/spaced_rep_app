import { RefreshCw, ImagePlus, Type, CodeXml } from 'lucide-react'
import type { ElementType } from 'react'

import type { SideContentType } from '@/types'

type CardButtonProps = {
  type: 'flip' | SideContentType
  onClick: () => void
  isDisabled?: boolean
}

export default function CardButton({
  type,
  isDisabled,
  onClick
}: CardButtonProps) {
  let Icon: ElementType | null = null
  let label = ''

  switch (type) {
    case 'flip':
      Icon = RefreshCw
      label = 'Flip'
      break
    case 'text':
      Icon = Type
      label = 'Text'
      break
    case 'image':
      Icon = ImagePlus
      label = 'Image'
      break
    case 'code':
      Icon = CodeXml
      label = 'Code'
      break

    default:
      return null
  }

  if (!Icon) return null

  return (
    <button
      onClick={onClick}
      className="flex flex-col justify-center items-center gap-1 disabled:opacity-50"
      disabled={isDisabled}
    >
      <span className="w-8 h-8 flex justify-center items-center border-2 rounded-full">
        <Icon className="w-4 h-4 text-black" strokeWidth={3} />
      </span>
      <span className="text-black text-sm font-semibold">{label}</span>
    </button>
  )
}
