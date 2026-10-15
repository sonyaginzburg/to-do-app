export const config = {
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:8080',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  sessionTtlSeconds: 7 * 24 * 60 * 60,
  authRateLimit: { max: 10, windowSeconds: 60 },
}

export const SESSION_COOKIE = 'sid'
