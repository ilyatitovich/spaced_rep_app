import { motion } from 'motion/react'

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

  // ensure fully hidden value is slightly > circumference
  const hiddenOffset = circumference + 1

  const offset = circumference * (1 - progress)

  return (
    <div className="relative w-8 h-8 flex items-center justify-center">
      <svg
        width="32"
        height="32"
        className="absolute top-0 left-0 rotate-[-90deg]"
      >
        {/* background circle */}
        <circle
          cx="16"
          cy="16"
          r={radius}
          strokeWidth="3"
          fill="none"
          className="stroke-gray-300"
        />

        {/* animated progress */}

        <motion.circle
          cx="16"
          cy="16"
          r={radius}
          stroke="black"
          strokeWidth="3"
          fill="none"
          strokeDasharray={circumference}
          animate={{
            strokeDashoffset: progress === 0 ? hiddenOffset : offset,
            strokeOpacity: progress === 0 ? 0 : 1
          }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          style={{ willChange: 'stroke-dashoffset, opacity' }}
        />
      </svg>

      {/* inner number */}
      <div className="absolute text-sm font-medium text-black">{current}</div>
    </div>
  )
}
