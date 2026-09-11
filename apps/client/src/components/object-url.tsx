import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { recordToBlob } from '@/lib'
import type { MediaDBRecord } from '@/types'

type ObjectUrlProps = {
  record: MediaDBRecord
  children: (url: string) => ReactNode
}

export default function ObjectUrl({ record, children }: ObjectUrlProps) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    const next = URL.createObjectURL(recordToBlob(record))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [record])

  if (!url) return null
  return <>{children(url)}</>
}
