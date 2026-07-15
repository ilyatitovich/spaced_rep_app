export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message)
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message)
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(400, message)
  }
}
