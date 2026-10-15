import type { RequestHandler } from 'express'
import { config } from './config.js'
import { readSessionId, setSessionCookie } from './cookies.js'
import { forbiddenOrigin, rateLimited, unauthenticated } from './errors.js'
import { redis } from './redis.js'
import { touchSession } from './sessions.js'

const STATE_CHANGING = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

// CSRF defence: browsers always send Origin on cross-site state-changing requests.
export const originCheck: RequestHandler = (req, _res, next) => {
  const origin = req.headers.origin
  if (STATE_CHANGING.has(req.method) && origin !== undefined && origin !== config.allowedOrigin) {
    return next(forbiddenOrigin())
  }
  next()
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const sessionId = readSessionId(req)
  if (!sessionId) return next(unauthenticated())

  const userId = await touchSession(sessionId)
  if (!userId) return next(unauthenticated())

  setSessionCookie(res, sessionId)
  res.locals.userId = userId
  res.locals.sessionId = sessionId
  next()
}

// Shared counter for login and register: 10 attempts per minute per IP.
export const authRateLimit: RequestHandler = async (req, _res, next) => {
  const { max, windowSeconds } = config.authRateLimit
  const key = `ratelimit:auth:${req.ip}`
  const results = await redis.multi().incr(key).expire(key, windowSeconds, 'NX').exec()
  const count = Number(results?.[0]?.[1] ?? 0)
  if (count > max) return next(rateLimited())
  next()
}
