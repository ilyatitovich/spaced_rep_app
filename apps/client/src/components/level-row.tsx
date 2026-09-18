import { ChevronRight } from 'lucide-react'

import { levelLabel } from '@/lib'
import Button from './ui/button'

type LevelRowProps = {
  levelId: number
  cardsNumber: number
  onLevelOpen: () => void
}

export default function LevelRow({
  levelId,
  cardsNumber,
  onLevelOpen
}: LevelRowProps) {
  let leftContent = (
    <>
      <span className={`w-2 h-2 rounded-full bg-lvl-${levelId}`}></span>
      <span className="flex flex-col text-foreground text-left">
        <span>{levelLabel(levelId)}</span>
        <span className="text-foreground-muted text-sm">
          {levelId === 1
            ? 'Everyday'
            : `Every ${Math.pow(2, levelId) / 2} days`}
        </span>
      </span>
    </>
  )

  if (levelId === 0 || levelId === 8) {
    leftContent = <span className="flex flex-col">{levelLabel(levelId)}</span>
  }

  if (levelId === 0 && cardsNumber === 0) {
    return null
  }

  return (
    <li className="py-3.5 border-b border-border last:border-b-0">
      <Button
        variant="unstyled"
        onClick={onLevelOpen}
        className="w-full flex justify-between items-center"
      >
        <span className="flex items-center gap-3 text-lg">{leftContent}</span>
        <span className="flex items-center gap-3 text-foreground-muted">
          <span className="text-lg">{`${cardsNumber} card${cardsNumber === 1 ? '' : 's'}`}</span>
          <ChevronRight className="text-sm" />
        </span>
      </Button>
    </li>
  )
}
