import { useEffect } from 'react'

type TurnstileWidgetProps = {
  onToken: (token: string | null) => void
}

export default function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  useEffect(() => {
    onToken('extension')
  }, [onToken])
  return null
}
