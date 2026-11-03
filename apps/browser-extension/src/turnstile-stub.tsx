interface TurnstileWidgetProps {
  onToken: (token: string | null) => void
}

/**
 * The extension has no Turnstile: it never supplies a token, and the server
 * never trusts `Origin` instead. Email sign-in is therefore disabled here.
 */
const TurnstileWidget: (props: TurnstileWidgetProps) => null = () => null

export default TurnstileWidget
