import type { ErrorRequestHandler, RequestHandler } from 'express'

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export const validationError = (fields: Record<string, string>) =>
  new AppError(400, 'VALIDATION_ERROR', 'Invalid input', fields)
export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Please log in')
export const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
export const forbiddenOrigin = () =>
  new AppError(403, 'FORBIDDEN_ORIGIN', 'Request origin not allowed')
export const notFound = () => new AppError(404, 'NOT_FOUND', 'Not found')
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message)
export const rateLimited = () =>
  new AppError(429, 'RATE_LIMITED', 'Too many attempts, try again later')

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound())

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err)

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    })
    return
  }

  if (err?.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON', fields: {} } })
    return
  }

  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } })
}
