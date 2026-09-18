import { useEffect, useState } from 'react'

type AvatarProps = {
  url?: string
  initial?: string
  size?: 'sm' | 'md'
}

const sizeClasses = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-12 h-12 text-lg'
} as const

export default function Avatar({
  url,
  initial = '?',
  size = 'md'
}: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const sizeClass = sizeClasses[size]

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0`}
    >
      {initial}
    </div>
  )
}
