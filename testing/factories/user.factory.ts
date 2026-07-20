import { faker } from '@faker-js/faker'
import type { User } from '../../apps/server/src/generated/prisma/client.js'
import { getTestPrisma } from '../db/prisma.js'

export type UserBuildInput = {
  email: string
  emailVerifiedAt: Date | null
}

export const userFactory = {
  build(overrides: Partial<UserBuildInput> = {}): UserBuildInput {
    return {
      email: faker.internet.email().toLowerCase(),
      emailVerifiedAt: new Date(),
      ...overrides
    }
  },

  async create(overrides: Partial<UserBuildInput> = {}): Promise<User> {
    const data = userFactory.build(overrides)
    const prisma = getTestPrisma()

    return prisma.user.create({
      data: {
        email: data.email,
        emailVerifiedAt: data.emailVerifiedAt
      }
    })
  }
}
