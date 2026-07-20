import { faker } from '@faker-js/faker'
import { FAKER_SEED } from '../config/constants.js'

export function seedFaker(seed = FAKER_SEED): void {
  faker.seed(seed)
}

/** Reset faker to the default deterministic seed before a test run or suite. */
export function prepareTestRun(seed = FAKER_SEED): void {
  seedFaker(seed)
}
