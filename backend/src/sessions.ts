import { createHash, randomBytes } from 'node:crypto'
import { config } from './config.js'
import { redis } from './redis.js'

// Redis stores only a hash of the session id, so a leaked Redis dump cannot be replayed as cookies.
export const sessionKey = (sessionId: string) =>
  `session:${createHash('sha256').update(sessionId).digest('hex')}`

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString('base64url')
  await redis.set(sessionKey(sessionId), JSON.stringify({ userId }), 'EX', config.sessionTtlSeconds)
  return sessionId
}

// Reads the session and resets its expiry in one atomic step (sliding expiration).
export async function touchSession(sessionId: string): Promise<string | null> {
  const value = await redis.getex(sessionKey(sessionId), 'EX', config.sessionTtlSeconds)
  if (!value) return null
  return (JSON.parse(value) as { userId: string }).userId
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(sessionKey(sessionId))
}
