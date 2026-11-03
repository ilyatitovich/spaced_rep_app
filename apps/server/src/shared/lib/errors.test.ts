import {
  AppError,
  BadGatewayError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError
} from './errors.js'

describe('AppError subclasses', () => {
  it.each([
    ['BadRequestError', BadRequestError, 400, 'BAD_REQUEST'],
    ['UnauthorizedError', UnauthorizedError, 401, 'UNAUTHORIZED'],
    ['ForbiddenError', ForbiddenError, 403, 'FORBIDDEN'],
    ['NotFoundError', NotFoundError, 404, 'NOT_FOUND'],
    ['TooManyRequestsError', TooManyRequestsError, 429, 'RATE_LIMITED'],
    ['BadGatewayError', BadGatewayError, 502, 'BAD_GATEWAY']
  ])('%s keeps its own prototype', (_name, Subclass, status, code) => {
    const err = new Subclass()

    expect(err).toBeInstanceOf(Subclass)
    expect(err).toBeInstanceOf(AppError)
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(status)
    expect(err.code).toBe(code)
  })

  it('does not match a sibling class', () => {
    expect(new BadRequestError()).not.toBeInstanceOf(UnauthorizedError)
    expect(new UnauthorizedError()).not.toBeInstanceOf(BadRequestError)
  })
})
