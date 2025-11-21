import { ChevronLeft } from 'lucide-react'
import { useSearchParams } from 'react-router'

import Button from './button'
import { removeLastSearchParam } from '@/lib'

export default function BackButton() {
  const [, setSearchParams] = useSearchParams()

  return (
    <Button
      onClick={() => {
        setSearchParams(prev => removeLastSearchParam(prev))
      }}
    >
      <ChevronLeft size={28} />
    </Button>
  )
}
