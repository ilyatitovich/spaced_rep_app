export type AuthUser = {
  id: string
  email: string
  user_metadata?: { avatar_url: string }
}

export function toAuthUser(user: {
  id: string
  email: string
  avatarUrl?: string | null
}): AuthUser {
  if (!user.avatarUrl) {
    return { id: user.id, email: user.email }
  }
  return {
    id: user.id,
    email: user.email,
    user_metadata: { avatar_url: user.avatarUrl }
  }
}
