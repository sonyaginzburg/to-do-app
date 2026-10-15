import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from './db.js'
import { api, cleanup, registerUser } from './testing/helpers.js'

afterAll(cleanup)

describe('US8 Tags', () => {
  it('AC8.1 creates a tag and lists it, sorted case-insensitively', async () => {
    const { cookie, client } = await registerUser()

    const created = await client.post('/api/tags', { name: '  school ' }, cookie)
    expect(created.status).toBe(201)
    expect(created.body).toEqual({ id: expect.any(String), name: 'school' })
    await client.post('/api/tags', { name: 'Work' }, cookie)
    await client.post('/api/tags', { name: 'admin' }, cookie)

    const list = await client.get('/api/tags', cookie)
    expect(list.status).toBe(200)
    expect(list.body.map((t: { name: string }) => t.name)).toEqual(['admin', 'school', 'Work'])
  })

  it('AC8.2 rejects a duplicate name in any case with 409', async () => {
    const { cookie, client } = await registerUser()
    await client.post('/api/tags', { name: 'school' }, cookie)

    const dup = await client.post('/api/tags', { name: 'SCHOOL' }, cookie)
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBeDefined()

    const list = await client.get('/api/tags', cookie)
    expect(list.body).toHaveLength(1)
  })

  it('AC8.2 rejects renaming a tag to an existing name with 409', async () => {
    const { cookie, client } = await registerUser()
    await client.post('/api/tags', { name: 'school' }, cookie)
    const other = await client.post('/api/tags', { name: 'home' }, cookie)

    const res = await client.patch(`/api/tags/${other.body.id}`, { name: 'School' }, cookie)
    expect(res.status).toBe(409)
  })

  it('renames a tag, including only changing its case', async () => {
    const { cookie, client } = await registerUser()
    const tag = await client.post('/api/tags', { name: 'school' }, cookie)

    const res = await client.patch(`/api/tags/${tag.body.id}`, { name: 'School' }, cookie)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: tag.body.id, name: 'School' })
  })

  it('AC8.3 deleting a tag removes it from todos but keeps the todos', async () => {
    const { cookie, client, id: userId } = await registerUser()
    const tag = await client.post('/api/tags', { name: 'school' }, cookie)
    const todo = await prisma.todo.create({
      data: { userId, title: 'Read chapter 3', tags: { create: { tagId: tag.body.id } } },
    })

    const res = await client.delete(`/api/tags/${tag.body.id}`, cookie)
    expect(res.status).toBe(204)

    expect(await prisma.todo.findUnique({ where: { id: todo.id } })).not.toBeNull()
    expect(await prisma.todoTag.count({ where: { todoId: todo.id } })).toBe(0)
  })

  it('AC8.4 another user can have a tag with the same name', async () => {
    const a = await registerUser()
    const b = await registerUser()
    await a.client.post('/api/tags', { name: 'school' }, a.cookie)

    const res = await b.client.post('/api/tags', { name: 'school' }, b.cookie)
    expect(res.status).toBe(201)
  })

  it('AC8.5 rejects names over 30 characters, empty names and a missing name with 400', async () => {
    const { cookie, client } = await registerUser()

    const tooLong = await client.post('/api/tags', { name: 'x'.repeat(31) }, cookie)
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.error.fields.name).toBeDefined()

    expect((await client.post('/api/tags', { name: '   ' }, cookie)).status).toBe(400)
    expect((await client.post('/api/tags', {}, cookie)).status).toBe(400)
    expect((await client.get('/api/tags', cookie)).body).toHaveLength(0)

    const ok = await client.post('/api/tags', { name: 'x'.repeat(30) }, cookie)
    expect(ok.status).toBe(201)
  })

  it("only lists the current user's tags", async () => {
    const a = await registerUser()
    const b = await registerUser()
    await a.client.post('/api/tags', { name: 'mine' }, a.cookie)

    expect((await b.client.get('/api/tags', b.cookie)).body).toEqual([])
  })
})

describe('Tag access control', () => {
  it('returns 401 on every tag route without a session', async () => {
    const client = api()
    const id = '0191f3e0-0000-7000-8000-000000000000'

    expect((await client.get('/api/tags')).status).toBe(401)
    expect((await client.post('/api/tags', { name: 'a' })).status).toBe(401)
    expect((await client.patch(`/api/tags/${id}`, { name: 'a' })).status).toBe(401)
    expect((await client.delete(`/api/tags/${id}`)).status).toBe(401)
  })

  it("returns 404 when touching another user's tag", async () => {
    const a = await registerUser()
    const b = await registerUser()
    const tag = await a.client.post('/api/tags', { name: 'private' }, a.cookie)

    const patch = await b.client.patch(`/api/tags/${tag.body.id}`, { name: 'hacked' }, b.cookie)
    expect(patch.status).toBe(404)
    const del = await b.client.delete(`/api/tags/${tag.body.id}`, b.cookie)
    expect(del.status).toBe(404)

    const still = await a.client.get('/api/tags', a.cookie)
    expect(still.body).toEqual([{ id: tag.body.id, name: 'private' }])
  })

  it('returns 404 for a malformed id and for an unknown id', async () => {
    const { cookie, client } = await registerUser()

    expect((await client.patch('/api/tags/not-a-uuid', { name: 'a' }, cookie)).status).toBe(404)
    expect((await client.delete('/api/tags/not-a-uuid', cookie)).status).toBe(404)
    const unknown = '0191f3e0-0000-7000-8000-000000000000'
    expect((await client.delete(`/api/tags/${unknown}`, cookie)).status).toBe(404)
  })

  it('rejects a cross-origin state-changing request with 403', async () => {
    const { cookie, client } = await registerUser()

    const res = await client.post('/api/tags', { name: 'evil' }, cookie, 'http://evil.example')
    expect(res.status).toBe(403)
    expect((await client.get('/api/tags', cookie)).body).toHaveLength(0)
  })
})
