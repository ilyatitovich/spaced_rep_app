import { describe, expect, it } from 'vitest'
import { toAuthUser } from './auth-user.js'

describe('toAuthUser', () => {
  it('includes Google avatar_url in user_metadata when present', () => {
    expect(
      toAuthUser({
        id: 'u1',
        email: 'a@b.com',
        avatarUrl: 'https://lh3.googleusercontent.com/a/photo'
      })
    ).toEqual({
      id: 'u1',
      email: 'a@b.com',
      user_metadata: {
        avatar_url: 'https://lh3.googleusercontent.com/a/photo'
      }
    })
  })

  it('omits user_metadata when avatar is missing', () => {
    expect(toAuthUser({ id: 'u1', email: 'a@b.com' })).toEqual({
      id: 'u1',
      email: 'a@b.com'
    })
  })
})
