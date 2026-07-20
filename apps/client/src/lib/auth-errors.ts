import { ApiError } from './api'

export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Something went wrong. Please try again.'
  }

  const code =
    error instanceof ApiError
      ? (error.code ?? '')
      : ((error as { code?: string }).code ?? '')
  const message = error.message.toLowerCase()

  if (code === 'RATE_LIMITED' || code === 'over_email_send_rate_limit') {
    return 'Too many attempts. Please wait a minute and try again.'
  }

  if (message.includes('rate limit')) {
    return 'Too many attempts. Please wait a minute and try again.'
  }

  if (code === 'TURNSTILE_FAILED') {
    return 'Bot verification failed. Please try again.'
  }

  if (code === 'OTP_INVALID' || code === 'otp_expired') {
    return 'Invalid or expired code. Request a new one.'
  }

  if (code === 'CHALLENGE_INVALID') {
    return 'Passkey challenge expired. Please try again.'
  }

  if (
    code === 'PASSKEY_VERIFY_FAILED' ||
    code === 'PASSKEY_NOT_FOUND' ||
    code === 'PASSKEY_REVOKED' ||
    code === 'PASSKEY_COUNTER_INVALID'
  ) {
    return 'Passkey sign-in failed. Try again or use another method.'
  }

  if (message.includes('cancelled')) {
    return error.message
  }

  if (
    message.includes('aren’t supported') ||
    message.includes("aren't supported")
  ) {
    return 'Passkeys aren’t supported in this browser.'
  }

  if (message.includes('expired')) {
    return 'Code expired. Request a new one.'
  }

  if (
    (message.includes('invalid') && message.includes('token')) ||
    (message.includes('invalid') && message.includes('code'))
  ) {
    return 'Invalid code. Check the email and try again.'
  }

  if (message.includes('email') && message.includes('invalid')) {
    return 'Please enter a valid email address.'
  }

  return error.message || 'Something went wrong. Please try again.'
}
