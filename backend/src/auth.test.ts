import { randomBytes } from 'node:crypto'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { prisma } from './db.js'
import { redis } from './redis.js'
import { sessionKey } from './sessions.js'

const app = createApp()
const ORIGIN = 'http://localhost:8080'
const PASSWORD = 'correct horse'

let counter = 0
const unique = () => `${Date.now()}-${counter++}`
const emailFor = () => `auth-test-${unique()}@test.com`
// Every test uses its own random client IP so the per-IP rate limit (kept in Redis for 60s)
// never leaks between tests or between test runs.
const ipFor = () => Array.from(randomBytes(4), (b) => b).join('.')

function api(ip = ipFor()) {
  const post = (url: string, body?: object, cookie?: string, origin = ORIGIN) => {
    const req = request(app).post(url).set('X-Forwarded-For', ip).set('Origin', origin)
    if (cookie) req.set('Cookie', cookie)
    return req.send(body)
  }
  const get = (url: string, cookie?: string) => {
    const req = request(app).get(url).set('X-Forwarded-For', ip)
    if (cookie) req.set('Cookie', cookie)
    return req
  }
  return { post, get }
}

const sessionCookie = (res: request.Response) =>
  (res.headers['set-cookie'] as unknown as string[] | undefined)
    ?.find((c) => c.startsWith('sid='))
    ?.split(';')[0]

async function registerUser(client = api()) {
  const email = emailFor()
  const res = await client.post('/api/auth/register', { email, password: PASSWORD })
  return { email, res, cookie: sessionCookie(res)!, client }
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: 'auth-test-' } } })
  await prisma.$disconnect()
  redis.disconnect()
})

describe('US1 Register', () => {
  it('AC1.1 creates the account, logs me in and returns the user', async () => {
    const { email, res, cookie, client } = await registerUser()

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ id: expect.any(String), email })
    expect(res.body.password).toBeUndefined()

    const me = await client.get('/api/auth/me', cookie)
    expect(me.status).toBe(200)
    expect(me.body.email).toBe(email)
  })

  it('stores an argon2 hash, never the plain password', async () => {
    const { email } = await registerUser()
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(user.passwordHash).toMatch(/^\$argon2/)
    expect(user.passwordHash).not.toContain(PASSWORD)
  })

  it('normalises the email to lowercase and trims it', async () => {
    const base = emailFor()
    const res = await api().post('/api/auth/register', {
      email: `  ${base.toUpperCase()} `,
      password: PASSWORD,
    })
    expect(res.status).toBe(201)
    expect(res.body.email).toBe(base)
  })

  it('AC1.2 rejects an email that is already registered (any letter case)', async () => {
    const { email } = await registerUser()
    const res = await api().post('/api/auth/register', {
      email: email.toUpperCase(),
      password: PASSWORD,
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
    expect(await prisma.user.count({ where: { email } })).toBe(1)
  })

  it('AC1.3 rejects an invalid email with a field error and creates no account', async () => {
    const before = await prisma.user.count()
    const res = await api().post('/api/auth/register', {
      email: 'not-an-email',
      password: PASSWORD,
    })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.fields.email).toBeTruthy()
    expect(await prisma.user.count()).toBe(before)
  })

  it('AC1.3 rejects a password shorter than 8 characters', async () => {
    const email = emailFor()
    const res = await api().post('/api/auth/register', { email, password: '1234567' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.password).toBeTruthy()
    expect(await prisma.user.count({ where: { email } })).toBe(0)
  })

  it('accepts a password of exactly 8 characters with no composition rules', async () => {
    const res = await api().post('/api/auth/register', { email: emailFor(), password: 'abcdefgh' })
    expect(res.status).toBe(201)
  })

  it('returns 400 for a missing body and for malformed JSON', async () => {
    const missing = await api().post('/api/auth/register')
    expect(missing.status).toBe(400)
    expect(missing.body.error.code).toBe('VALIDATION_ERROR')

    const malformed = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', ipFor())
      .set('Content-Type', 'application/json')
      .send('{"email": ')
    expect(malformed.status).toBe(400)
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('US2 Log in / log out', () => {
  it('AC2.1 logs in with correct credentials', async () => {
    const { email, client } = await registerUser()
    const res = await client.post('/api/auth/login', { email, password: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.email).toBe(email)
    expect(sessionCookie(res)).toBeTruthy()
  })

  it('sets the session cookie HttpOnly and SameSite=Lax', async () => {
    const { res } = await registerUser()
    const raw = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('sid='),
    )!
    expect(raw).toMatch(/HttpOnly/i)
    expect(raw).toMatch(/SameSite=Lax/i)
    expect(raw).toMatch(/Path=\//i)
  })

  it('AC2.2 gives the same generic error for a wrong password and an unknown email', async () => {
    const { email, client } = await registerUser()
    const wrongPassword = await client.post('/api/auth/login', {
      email,
      password: 'wrong-password',
    })
    const unknownEmail = await client.post('/api/auth/login', {
      email: emailFor(),
      password: PASSWORD,
    })

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body).toEqual(unknownEmail.body)
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(sessionCookie(wrongPassword)).toBeUndefined()
  })

  it('returns 400 when login fields are missing or invalid', async () => {
    const res = await api().post('/api/auth/login', { email: 'nope' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.email).toBeTruthy()
    expect(res.body.error.fields.password).toBeTruthy()
  })

  it('AC2.3 logout ends the session so the old cookie no longer works', async () => {
    const { cookie, client } = await registerUser()

    const out = await client.post('/api/auth/logout', undefined, cookie)
    expect(out.status).toBe(204)

    const me = await client.get('/api/auth/me', cookie)
    expect(me.status).toBe(401)
  })

  it('logout without a session returns 401', async () => {
    const res = await api().post('/api/auth/logout')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('AC2.4 a protected endpoint without a valid session returns 401', async () => {
    const client = api()
    const none = await client.get('/api/auth/me')
    expect(none.status).toBe(401)
    expect(none.body.error.code).toBe('UNAUTHENTICATED')

    const forged = await client.get('/api/auth/me', 'sid=not-a-real-session')
    expect(forged.status).toBe(401)
  })

  it('AC2.5 returns 429 after 10 attempts in a minute and does not check the password', async () => {
    const { email, client } = await registerUser()
    // registerUser used 1 attempt; make 9 more wrong attempts to reach 10.
    for (let i = 0; i < 9; i++) {
      const res = await client.post('/api/auth/login', { email, password: 'wrong-password' })
      expect(res.status).toBe(401)
    }

    const blocked = await client.post('/api/auth/login', { email, password: PASSWORD })
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
    expect(sessionCookie(blocked)).toBeUndefined()
  })

  it('rate limits per IP: another IP is unaffected', async () => {
    const limited = api()
    for (let i = 0; i < 10; i++)
      await limited.post('/api/auth/login', { email: 'a@b.co', password: 'x' })
    expect((await limited.post('/api/auth/login', { email: 'a@b.co', password: 'x' })).status).toBe(
      429,
    )

    const other = await api().post('/api/auth/login', { email: 'a@b.co', password: 'x' })
    expect(other.status).toBe(401)
  })

  it('AC2.6 extends the session expiry to 7 days on each use', async () => {
    const { cookie, client } = await registerUser()
    const sessionId = decodeURIComponent(cookie.slice('sid='.length))

    await redis.expire(sessionKey(sessionId), 100)
    expect(await redis.ttl(sessionKey(sessionId))).toBeLessThanOrEqual(100)

    const me = await client.get('/api/auth/me', cookie)
    expect(me.status).toBe(200)

    const ttl = await redis.ttl(sessionKey(sessionId))
    expect(ttl).toBeGreaterThan(7 * 24 * 60 * 60 - 60)
  })
})

describe('Sessions in Redis', () => {
  it('stores the SHA-256 hash of the session id, not the id itself', async () => {
    const { cookie, res } = await registerUser()
    const sessionId = decodeURIComponent(cookie.slice('sid='.length))

    expect(await redis.exists(`session:${sessionId}`)).toBe(0)
    const stored = await redis.get(sessionKey(sessionId))
    expect(JSON.parse(stored!)).toEqual({ userId: res.body.id })
    expect(sessionKey(sessionId)).toMatch(/^session:[0-9a-f]{64}$/)
  })

  it('uses a long random session id that differs on every login', async () => {
    const { email, cookie, client } = await registerUser()
    const second = sessionCookie(
      await client.post('/api/auth/login', { email, password: PASSWORD }),
    )
    expect(second).not.toBe(cookie)
    expect(cookie.length).toBeGreaterThanOrEqual('sid='.length + 43)
  })
})

describe('CSRF origin check', () => {
  it('rejects a state-changing request from a foreign origin with 403 and keeps the session', async () => {
    const { cookie, client } = await registerUser()

    const blocked = await client.post('/api/auth/logout', undefined, cookie, 'https://evil.example')
    expect(blocked.status).toBe(403)
    expect(blocked.body.error.code).toBe('FORBIDDEN_ORIGIN')

    const me = await client.get('/api/auth/me', cookie)
    expect(me.status).toBe(200)
  })

  it('rejects a foreign-origin login and register', async () => {
    const client = api()
    const login = await client.post(
      '/api/auth/login',
      { email: 'a@b.co', password: 'x' },
      undefined,
      'https://evil.example',
    )
    expect(login.status).toBe(403)
    const reg = await client.post(
      '/api/auth/register',
      { email: emailFor(), password: PASSWORD },
      undefined,
      'https://evil.example',
    )
    expect(reg.status).toBe(403)
  })

  it('does not apply the origin check to GET requests', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('X-Forwarded-For', ipFor())
      .set('Origin', 'https://evil.example')
    expect(res.status).toBe(401)
  })
})

describe('General API behaviour', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
  })

  it('unknown routes return a 404 in the standard error format', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } })
  })

  it('does not reveal that the server runs Express', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})
