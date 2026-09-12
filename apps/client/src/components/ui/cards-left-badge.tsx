type CardsLeftBadgeProps = {
  current: number
  total: number
}

export default function CardsLeftBadge({
  current,
  total
}: CardsLeftBadgeProps) {
  const progress = 1 - current / total
  const radius = 14
  const circumference = 2 * Math.PI * radius
  const isHidden = progress === 0

  return (
    <div className="relative w-8 h-8 flex items-center justify-center">
      <svg width="32" height="32" className="absolute top-0 left-0 -rotate-90">
        <circle
          cx="16"
          cy="16"
          r={radius}
          strokeWidth="3"
          fill="none"
          className="stroke-border"
        />
        <circle
          cx="16"
          cy="16"
          r={radius}
          strokeWidth="3"
          fill="none"
          strokeDasharray={circumference}
          strokeLinecap="round"
          className="stroke-foreground transition-[stroke-dashoffset,opacity] duration-450 ease-in-out"
          style={{
            strokeDashoffset: isHidden ? circumference + 1 : circumference * (1 - progress),
            opacity: isHidden ? 0 : 1
          }}
        />
      </svg>
      <div className="absolute text-sm font-medium text-foreground">
        {current}
      </div>
    </div>
  )
}
