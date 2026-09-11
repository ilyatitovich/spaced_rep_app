import { RefreshCw, ImagePlus, Type, Volume2 } from 'lucide-react'
import type { ElementType } from 'react'

type CardButtonType = 'flip' | 'text' | 'image' | 'audio'

type CardButtonProps = {
  type: CardButtonType
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
    case 'audio':
      Icon = Volume2
      label = 'Audio'
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
        <Icon className="w-4 h-4 text-foreground" strokeWidth={3} />
      </span>
      <span className="text-foreground text-sm font-semibold">{label}</span>
    </button>
  )
}
