import argon2 from 'argon2'
import { Router } from 'express'
import { z } from 'zod'
import { clearSessionCookie, setSessionCookie } from './cookies.js'
import { prisma } from './db.js'
import { conflict, invalidCredentials, notFound, validationError } from './errors.js'
import { authRateLimit, requireAuth } from './middleware.js'
import { createSession, deleteSession } from './sessions.js'

const emailSchema = z
  .string({ error: 'Required' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address' }))

const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: 'Required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
})

const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Required' }).min(1, 'Required'),
})

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

// Verified when the email is unknown, so wrong-email and wrong-password take similar time.
const dummyHash = argon2.hash('not-a-real-password')

const isUniqueViolation = (err: unknown) =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'

export const authRouter = Router()

authRouter.post('/register', authRateLimit, async (req, res) => {
  const { email, password } = parseBody(registerSchema, req.body)
  const passwordHash = await argon2.hash(password)

  try {
    const user = await prisma.user.create({ data: { email, passwordHash } })
    setSessionCookie(res, await createSession(user.id))
    res.status(201).json({ id: user.id, email: user.email })
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('Email already registered')
    throw err
  }
})

authRouter.post('/login', authRateLimit, async (req, res) => {
  const { email, password } = parseBody(loginSchema, req.body)
  const user = await prisma.user.findUnique({ where: { email } })

  const valid = await argon2.verify(user?.passwordHash ?? (await dummyHash), password)
  if (!user || !valid) throw invalidCredentials()

  setSessionCookie(res, await createSession(user.id))
  res.status(200).json({ id: user.id, email: user.email })
})

authRouter.post('/logout', requireAuth, async (_req, res) => {
  await deleteSession(res.locals.sessionId)
  clearSessionCookie(res)
  res.status(204).end()
})

authRouter.get('/me', requireAuth, async (_req, res) => {
  const user = await prisma.user.findUnique({ where: { id: res.locals.userId } })
  if (!user) throw notFound()
  res.status(200).json({ id: user.id, email: user.email })
})
