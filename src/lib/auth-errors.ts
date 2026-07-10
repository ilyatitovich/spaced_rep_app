export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Something went wrong. Please try again.'
  }

  const code = (error as { code?: string }).code ?? ''
  const message = error.message.toLowerCase()

  if (code === 'over_email_send_rate_limit' || message.includes('rate limit')) {
    return 'Too many attempts. Please wait a minute and try again.'
  }

  if (code === 'otp_expired' || message.includes('expired')) {
    return 'Code expired. Request a new one.'
  }

  if (message.includes('invalid') && message.includes('token')) {
    return 'Invalid code. Check the email and try again.'
  }

  if (message.includes('email') && message.includes('invalid')) {
    return 'Please enter a valid email address.'
  }

  return error.message || 'Something went wrong. Please try again.'
}
