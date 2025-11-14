type TestButtonProps = {
  onClick: () => void
}

export default function TestButton({ onClick }: TestButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        absolute left-1/2 bottom-4 -translate-x-1/2
        w-2/3
        py-5
        text-center
        text-white
        font-semibold
        rounded-full
        bg-gradient-to-br from-purple-600 to-purple-800
        shadow-[0_8px_20px_rgba(168,85,247,0.4)]
        active:scale-95
        active:shadow-[0_4px_12px_rgba(168,85,247,0.3)]
        transition-all duration-300
      `}
    >
      Today’s Test
    </button>
  )
}
