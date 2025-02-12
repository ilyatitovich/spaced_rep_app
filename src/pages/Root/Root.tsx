import { updateVh } from '@/lib/utils'
import { useEffect } from 'react'
import { Outlet } from 'react-router'

export default function Root() {
  useEffect(() => {
    let prevHeight = window.innerHeight
    prevHeight = updateVh(prevHeight)

    const handleResize = () => {
      prevHeight = updateVh(prevHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return <Outlet />
}
