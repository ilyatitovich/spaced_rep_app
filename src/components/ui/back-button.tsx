import { ChevronLeft } from 'lucide-react'

import Button from './button'

type BackButtonProps = {
  onClick: () => void
}

export default function BackButton({ onClick }: BackButtonProps) {
  return (
    <Button onClick={onClick}>
      <ChevronLeft size={28} />
    </Button>
  )
}
