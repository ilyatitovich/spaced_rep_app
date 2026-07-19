import { joinNumbers } from '@/lib'

type TestButtonProps = {
  todayLevels: number[]
  onClick: () => void
}

export default function TestButton({ todayLevels, onClick }: TestButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        absolute left-1/2 bottom-4 -translate-x-1/2
        w-2/3
        py-4
        text-center
        text-primary-foreground
        font-semibold
        rounded-full
        bg-gradient-to-br from-primary to-primary-active
        shadow-primary
        active:scale-95
        active:shadow-primary-active
        transition-all duration-300
        flex flex-col gap-2 items-center
      `}
    >
      <span className="text-xl">Today’s Test</span>
      <span className="text-sm">{`Level${todayLevels.length > 1 ? `s` : ''}:  ${joinNumbers(todayLevels)}`}</span>
    </button>
  )
}
