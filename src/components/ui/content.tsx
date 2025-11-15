import type { ReactNode, Ref } from 'react'
import { forwardRef } from 'react'

type ContentProps = {
  children: ReactNode
  className?: string
  height?: 84 | 92 | 100
  centered?: boolean
  loading?: boolean
}

export default forwardRef(function Content(
  {
    children,
    className = '',
    height = 84,
    centered = false,
    loading = false
  }: ContentProps,
  ref: Ref<HTMLDivElement>
) {
  if (loading) {
    centered = true
  }

  return (
    <div
      ref={ref}
      className={`h-dvh-${height} p-4 overflow-y-auto ${className} ${centered ? 'flex items-center justify-center' : ''}`.trim()}
    >
      {loading ? <p>Loading...</p> : children}
    </div>
  )
})
