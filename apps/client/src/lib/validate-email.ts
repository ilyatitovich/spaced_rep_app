const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ValidateEmailResult =
  | { ok: true; email: string }
  | { ok: false; message: string }

export function validateEmail(value: string): ValidateEmailResult {
  const email = value.trim()

  if (!email) {
    return { ok: false, message: 'Please enter your email address' }
  }

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, message: 'Please enter a valid email address' }
  }

  return { ok: true, email }
}
