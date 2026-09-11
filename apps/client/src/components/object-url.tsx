import type { ReactNode } from 'react'

import { recordToBlob } from '@/lib'
import type { MediaDBRecord } from '@/types'

type ObjectUrlProps = {
  record: MediaDBRecord
  children: (url: string) => ReactNode
}

const urls = new WeakMap<ArrayBuffer, string>()

function urlFor(record: MediaDBRecord): string {
  const cached = urls.get(record.buffer)
  if (cached) return cached
  const url = URL.createObjectURL(recordToBlob(record))
  urls.set(record.buffer, url)
  return url
}

export default function ObjectUrl({ record, children }: ObjectUrlProps) {
  return <>{children(urlFor(record))}</>
}
