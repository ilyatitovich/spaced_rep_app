import 'vitest'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

type JestDomExpect = ReturnType<typeof expect.stringContaining>

/**
 * Vitest 5 made Assertion binary (`Assertion<R, T>`); jest-dom still
 * augments the Vitest 4 unary shape, so matchers never land on expect().
 * Remove this once @testing-library/jest-dom targets Vitest 5.
 */
declare module 'vitest' {
  interface Assertion<R = unknown, _T = unknown> extends TestingLibraryMatchers<
    JestDomExpect,
    R
  > {}

  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<
    JestDomExpect,
    unknown
  > {}
}
