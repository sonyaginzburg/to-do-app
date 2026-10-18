export const config = {
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:8080',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  sessionTtlSeconds: 7 * 24 * 60 * 60,
  // Production keeps the default of 10. The end-to-end test stack raises it so many tests can
  // register users from one IP without being blocked.
  authRateLimit: { max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10, windowSeconds: 60 },
}

export const SESSION_COOKIE = 'sid'
