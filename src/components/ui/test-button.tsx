import { joinNumbers } from '@/lib'
import { useScreenStore } from '@/stores'

type TestButtonProps = {
  todayLevels: number[]
}

export default function TestButton({ todayLevels }: TestButtonProps) {
  return (
    <button
      onClick={() => useScreenStore.getState().openScreen('test')}
      className={`
        absolute left-1/2 bottom-4 -translate-x-1/2
        w-2/3
        py-4
        text-center
        text-white
        font-semibold
        rounded-full
        bg-gradient-to-br from-purple-600 to-purple-800
        shadow-[0_8px_20px_rgba(168,85,247,0.4)]
        active:scale-95
        active:shadow-[0_4px_12px_rgba(168,85,247,0.3)]
        transition-all duration-300
        flex flex-col gap-2 items-center
      `}
    >
      <span className="text-xl">Today’s Test</span>
      <span className="text-sm">{`Level${todayLevels.length > 1 ? `s` : ''}:  ${joinNumbers(todayLevels)}`}</span>
    </button>
  )
}
