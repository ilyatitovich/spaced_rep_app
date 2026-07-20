import { test as base } from '@playwright/test'

/**
 * Base Playwright fixture extension point.
 * Shared hooks (DB reset, etc.) can be added here later without changing specs.
 */
export const test = base.extend({})

export { expect } from '@playwright/test'
