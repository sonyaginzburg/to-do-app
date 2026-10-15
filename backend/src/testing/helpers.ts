import { randomBytes } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../app.js'
import { prisma } from '../db.js'
import { redis } from '../redis.js'

export const app = createApp()
export const ORIGIN = 'http://localhost:8080'
export const PASSWORD = 'correct horse'

let counter = 0
export const unique = () => `${Date.now()}-${counter++}`

// Each client gets a random IP so the per-IP rate limit (kept in Redis for 60s)
// never leaks between tests or between test runs.
export const randomIp = () => Array.from(randomBytes(4), (b) => b).join('.')

export function api(ip = randomIp()) {
  const send = (
    method: 'post' | 'patch' | 'delete',
    url: string,
    body?: object,
    cookie?: string,
    origin = ORIGIN,
  ) => {
    const req = request(app)[method](url).set('X-Forwarded-For', ip).set('Origin', origin)
    if (cookie) req.set('Cookie', cookie)
    return req.send(body)
  }
  return {
    post: (url: string, body?: object, cookie?: string, origin?: string) =>
      send('post', url, body, cookie, origin),
    patch: (url: string, body?: object, cookie?: string, origin?: string) =>
      send('patch', url, body, cookie, origin),
    delete: (url: string, cookie?: string, origin?: string) =>
      send('delete', url, undefined, cookie, origin),
    get: (url: string, cookie?: string) => {
      const req = request(app).get(url).set('X-Forwarded-For', ip)
      if (cookie) req.set('Cookie', cookie)
      return req
    },
  }
}

export const sessionCookie = (res: request.Response) =>
  (res.headers['set-cookie'] as unknown as string[] | undefined)
    ?.find((c) => c.startsWith('sid='))
    ?.split(';')[0]

export const emailFor = () => `auth-test-${unique()}@test.com`

export async function registerUser(client = api()) {
  const email = emailFor()
  const res = await client.post('/api/auth/register', { email, password: PASSWORD })
  return { email, res, cookie: sessionCookie(res)!, client, id: res.body.id as string }
}

export async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { startsWith: 'auth-test-' } } })
  await prisma.$disconnect()
  redis.disconnect()
}
