import { z } from 'zod'
import { notFound, validationError } from './errors.js'

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {})
  if (result.success) return result.data
  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const name = String(issue.path[0] ?? 'body')
    fields[name] ??= issue.message
  }
  throw validationError(fields)
}

const uuidSchema = z.uuid()

// A malformed id can never match a row, so it is a 404 rather than a database error.
export function requireUuid(value: unknown): string {
  const result = uuidSchema.safeParse(value)
  if (!result.success) throw notFound()
  return result.data
}
