import { useEffect, useState } from 'react'

type AvatarProps = {
  url?: string
  initial?: string
}

export default function Avatar({ url, initial = '?' }: AvatarProps) {
  const [failed, setFailed] = useState(false)

  console.log(url)

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-12 h-12 rounded-full object-cover shrink-0"
      />
    )
  }

  return (
    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
      {initial}
    </div>
  )
}
