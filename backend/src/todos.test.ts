import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from './db.js'
import { api, cleanup, registerUser } from './testing/helpers.js'

afterAll(cleanup)

type Client = Awaited<ReturnType<typeof registerUser>>
type Item = { id: string; title: string; completed: boolean; dueDate: string | null }

const create = (u: Client, body: object) => u.client.post('/api/todos', body, u.cookie)
const list = (u: Client, query: string) => u.client.get(`/api/todos?${query}`, u.cookie)
const titles = (res: { body: { items: Item[] } }) => res.body.items.map((t) => t.title)
const WEEK = 'dueFrom=2026-10-12&dueTo=2026-10-18'
const MISSING = '0191f3e0-0000-7000-8000-000000000000'

describe('US3 Create a todo', () => {
  it('AC3.1 a title alone gives an unscheduled, incomplete, medium todo', async () => {
    const u = await registerUser()
    const res = await create(u, { title: '  Buy milk ' })

    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      id: expect.any(String),
      title: 'Buy milk',
      completed: false,
      priority: 'medium',
      dueDate: null,
      tags: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
  })

  it('AC3.2 rejects an empty, whitespace or over-200-character title', async () => {
    const u = await registerUser()

    for (const bad of ['', '   ', 'x'.repeat(201)]) {
      const res = await create(u, { title: bad })
      expect(res.status).toBe(400)
      expect(res.body.error.fields.title).toBeDefined()
    }
    expect((await create(u, {})).status).toBe(400)
    expect((await create(u, { title: 'x'.repeat(200) })).status).toBe(201)
    expect((await list(u, 'unscheduled=true')).body.total).toBe(1)
  })

  it('AC3.3 stores due date, priority and tags', async () => {
    const u = await registerUser()
    const tag = await u.client.post('/api/tags', { name: 'school' }, u.cookie)

    const res = await create(u, {
      title: 'Essay',
      dueDate: '2026-10-16',
      priority: 'high',
      tagIds: [tag.body.id],
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      dueDate: '2026-10-16',
      priority: 'high',
      tags: [{ id: tag.body.id, name: 'school' }],
    })
  })

  it('AC3.4 rejects 11 tags with 400 and creates nothing', async () => {
    const u = await registerUser()
    const ids: string[] = []
    for (let i = 0; i < 11; i++) {
      ids.push((await u.client.post('/api/tags', { name: `t${i}` }, u.cookie)).body.id)
    }

    const res = await create(u, { title: 'Too many', tagIds: ids })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.tagIds).toBe('A todo can have at most 10 tags')
    expect((await list(u, 'unscheduled=true')).body.total).toBe(0)

    expect((await create(u, { title: 'Ten', tagIds: ids.slice(0, 10) })).status).toBe(201)
  })

  it('rejects a bad priority, bad dates and a non-array tagIds', async () => {
    const u = await registerUser()

    expect((await create(u, { title: 'a', priority: 'urgent' })).status).toBe(400)
    expect((await create(u, { title: 'a', dueDate: '2026-02-30' })).status).toBe(400)
    expect((await create(u, { title: 'a', dueDate: '10/16/2026' })).status).toBe(400)
    expect((await create(u, { title: 'a', tagIds: 'nope' })).status).toBe(400)
  })

  it("returns 404 when a tag belongs to someone else or doesn't exist", async () => {
    const a = await registerUser()
    const b = await registerUser()
    const theirs = await b.client.post('/api/tags', { name: 'theirs' }, b.cookie)

    expect((await create(a, { title: 'a', tagIds: [theirs.body.id] })).status).toBe(404)
    expect((await create(a, { title: 'a', tagIds: [MISSING] })).status).toBe(404)
    expect((await list(a, 'unscheduled=true')).body.total).toBe(0)
  })
})

describe('US4 / US13 Listing and scopes', () => {
  it('AC4.1 a date range returns todos on those days, inclusive, as date strings', async () => {
    const u = await registerUser()
    for (const d of ['2026-10-11', '2026-10-12', '2026-10-15', '2026-10-18', '2026-10-19']) {
      await create(u, { title: d, dueDate: d })
    }
    await create(u, { title: 'no date' })

    const res = await list(u, WEEK)
    expect(res.status).toBe(200)
    expect(titles(res)).toEqual(['2026-10-12', '2026-10-15', '2026-10-18'])
    expect(res.body).toMatchObject({ total: 3, limit: 50, offset: 0 })
  })

  it('AC4.2 only returns my own todos', async () => {
    const a = await registerUser()
    const b = await registerUser()
    await create(a, { title: 'mine' })
    await create(b, { title: 'theirs' })

    expect(titles(await list(a, 'unscheduled=true'))).toEqual(['mine'])
  })

  it('AC4.3 unscheduled returns only todos without a due date', async () => {
    const u = await registerUser()
    await create(u, { title: 'floating' })
    await create(u, { title: 'dated', dueDate: '2026-10-15' })

    expect(titles(await list(u, 'unscheduled=true'))).toEqual(['floating'])
  })

  it('AC4.4 pages overdue todos: 25 overdue, limit 20, then offset 20', async () => {
    const u = await registerUser()
    await prisma.todo.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        userId: u.id,
        title: `overdue ${i}`,
        dueDate: new Date(Date.UTC(2026, 8, 1 + i)),
      })),
    })

    const first = await list(u, 'overdueBefore=2026-10-15&limit=20')
    expect(first.body.items).toHaveLength(20)
    expect(first.body).toMatchObject({ total: 25, limit: 20, offset: 0 })

    const rest = await list(u, 'overdueBefore=2026-10-15&limit=20&offset=20')
    expect(rest.body.items).toHaveLength(5)
    expect(new Set([...first.body.items, ...rest.body.items].map((t: Item) => t.id)).size).toBe(25)
  })

  it('AC4.5 requires exactly one scope', async () => {
    const u = await registerUser()

    expect((await list(u, '')).status).toBe(400)
    expect((await list(u, 'priority=high')).status).toBe(400)
    expect((await list(u, `${WEEK}&unscheduled=true`)).status).toBe(400)
    expect((await list(u, 'unscheduled=true&overdueBefore=2026-10-15')).status).toBe(400)
    expect((await list(u, 'unscheduled=false')).status).toBe(400)
  })

  it('validates the date range: both ends, order, and a 31-day maximum', async () => {
    const u = await registerUser()

    expect((await list(u, 'dueFrom=2026-10-12')).status).toBe(400)
    expect((await list(u, 'dueFrom=2026-10-18&dueTo=2026-10-12')).status).toBe(400)
    expect((await list(u, 'dueFrom=2026-10-01&dueTo=2026-11-01')).status).toBe(200)
    expect((await list(u, 'dueFrom=2026-10-01&dueTo=2026-11-02')).status).toBe(400)
    expect((await list(u, 'dueFrom=nope&dueTo=2026-11-02')).status).toBe(400)
  })

  it('validates paging limits', async () => {
    const u = await registerUser()

    expect((await list(u, 'unscheduled=true&limit=200')).status).toBe(200)
    expect((await list(u, 'unscheduled=true&limit=201')).status).toBe(400)
    expect((await list(u, 'unscheduled=true&limit=0')).status).toBe(400)
    expect((await list(u, 'unscheduled=true&offset=-1')).status).toBe(400)
    expect((await list(u, 'unscheduled=true&limit=abc')).status).toBe(400)
  })

  it('AC13.1-13.3 overdue has incomplete todos before today only', async () => {
    const u = await registerUser()
    await create(u, { title: 'late', dueDate: '2026-10-14' })
    await create(u, { title: 'today', dueDate: '2026-10-15' })
    const done = await create(u, { title: 'late but done', dueDate: '2026-10-13' })
    await u.client.patch(`/api/todos/${done.body.id}`, { completed: true }, u.cookie)

    expect(titles(await list(u, 'overdueBefore=2026-10-15'))).toEqual(['late'])
    expect(titles(await list(u, 'dueFrom=2026-10-13&dueTo=2026-10-13'))).toEqual(['late but done'])
  })

  it('AC13.5 overdue lists the oldest due date first', async () => {
    const u = await registerUser()
    await create(u, { title: 'newer', dueDate: '2026-10-14' })
    await create(u, { title: 'oldest', dueDate: '2026-09-01' })
    await create(u, { title: 'middle', dueDate: '2026-10-01' })

    expect(titles(await list(u, 'overdueBefore=2026-10-15'))).toEqual(['oldest', 'middle', 'newer'])
  })

  it('overdueBefore combined with completed=true is a 400', async () => {
    const u = await registerUser()

    expect((await list(u, 'overdueBefore=2026-10-15&completed=true')).status).toBe(400)
    expect((await list(u, 'overdueBefore=2026-10-15&completed=false')).status).toBe(200)
  })
})

describe('US9 Filters', () => {
  it('AC9.1-9.4 filters by priority, completed and tag, combined with AND', async () => {
    const u = await registerUser()
    const school = await u.client.post('/api/tags', { name: 'school' }, u.cookie)
    const day = '2026-10-15'
    await create(u, {
      title: 'hi school',
      dueDate: day,
      priority: 'high',
      tagIds: [school.body.id],
    })
    await create(u, { title: 'lo school', dueDate: day, priority: 'low', tagIds: [school.body.id] })
    await create(u, { title: 'hi plain', dueDate: day, priority: 'high' })
    const done = await create(u, { title: 'hi done', dueDate: day, priority: 'high' })
    await u.client.patch(`/api/todos/${done.body.id}`, { completed: true }, u.cookie)

    expect(titles(await list(u, `${WEEK}&priority=high`)).sort()).toEqual([
      'hi done',
      'hi plain',
      'hi school',
    ])
    expect(titles(await list(u, `${WEEK}&completed=false`))).not.toContain('hi done')
    expect(titles(await list(u, `${WEEK}&completed=true`))).toEqual(['hi done'])
    expect(titles(await list(u, `${WEEK}&tagId=${school.body.id}`)).sort()).toEqual([
      'hi school',
      'lo school',
    ])
    expect(titles(await list(u, `${WEEK}&tagId=${school.body.id}&priority=high`))).toEqual([
      'hi school',
    ])
  })

  it('returns 404 for a tag filter that is not mine and 400 for an invalid priority', async () => {
    const a = await registerUser()
    const b = await registerUser()
    const theirs = await b.client.post('/api/tags', { name: 'theirs' }, b.cookie)

    expect((await list(a, `${WEEK}&tagId=${theirs.body.id}`)).status).toBe(404)
    expect((await list(a, `${WEEK}&priority=urgent`)).status).toBe(400)
  })

  it('total counts the filtered set, not just the page', async () => {
    const u = await registerUser()
    for (let i = 0; i < 3; i++) await create(u, { title: `t${i}`, priority: 'high' })
    await create(u, { title: 'low', priority: 'low' })

    const res = await list(u, 'unscheduled=true&priority=high&limit=2')
    expect(res.body.items).toHaveLength(2)
    expect(res.body.total).toBe(3)
  })
})

describe('US10 Ordering', () => {
  it('AC10.1 high priority before low on the same day', async () => {
    const u = await registerUser()
    await create(u, { title: 'low', dueDate: '2026-10-15', priority: 'low' })
    await create(u, { title: 'medium', dueDate: '2026-10-15' })
    await create(u, { title: 'high', dueDate: '2026-10-15', priority: 'high' })

    expect(titles(await list(u, WEEK))).toEqual(['high', 'medium', 'low'])
  })

  it('AC10.2 same priority: earlier created first', async () => {
    const u = await registerUser()
    await create(u, { title: 'first', dueDate: '2026-10-15' })
    await create(u, { title: 'second', dueDate: '2026-10-15' })
    await create(u, { title: 'third', dueDate: '2026-10-15' })

    expect(titles(await list(u, WEEK))).toEqual(['first', 'second', 'third'])
  })

  it('AC10.3 incomplete before completed, even when the completed one has higher priority', async () => {
    const u = await registerUser()
    const done = await create(u, { title: 'done high', dueDate: '2026-10-15', priority: 'high' })
    await create(u, { title: 'open low', dueDate: '2026-10-15', priority: 'low' })
    await u.client.patch(`/api/todos/${done.body.id}`, { completed: true }, u.cookie)

    expect(titles(await list(u, WEEK))).toEqual(['open low', 'done high'])
  })

  it('groups a range by day first, then applies the other rules', async () => {
    const u = await registerUser()
    await create(u, { title: 'fri high', dueDate: '2026-10-16', priority: 'high' })
    await create(u, { title: 'wed low', dueDate: '2026-10-14', priority: 'low' })
    await create(u, { title: 'wed high', dueDate: '2026-10-14', priority: 'high' })

    expect(titles(await list(u, WEEK))).toEqual(['wed high', 'wed low', 'fri high'])
  })
})

describe('US5 / US6 / US12 Update', () => {
  it('AC5.1 changes title, due date, priority and tags', async () => {
    const u = await registerUser()
    const tag = await u.client.post('/api/tags', { name: 'home' }, u.cookie)
    const todo = await create(u, { title: 'old' })

    const res = await u.client.patch(
      `/api/todos/${todo.body.id}`,
      { title: ' new ', dueDate: '2026-10-17', priority: 'low', tagIds: [tag.body.id] },
      u.cookie,
    )
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      title: 'new',
      dueDate: '2026-10-17',
      priority: 'low',
      tags: [{ id: tag.body.id, name: 'home' }],
    })

    const reloaded = await u.client.get(`/api/todos/${todo.body.id}`, u.cookie)
    expect(reloaded.body).toMatchObject({ title: 'new', dueDate: '2026-10-17' })
  })

  it('a partial update leaves other fields alone; tagIds [] clears tags', async () => {
    const u = await registerUser()
    const tag = await u.client.post('/api/tags', { name: 'home' }, u.cookie)
    const todo = await create(u, {
      title: 'keep',
      dueDate: '2026-10-15',
      priority: 'high',
      tagIds: [tag.body.id],
    })

    const res = await u.client.patch(`/api/todos/${todo.body.id}`, { completed: true }, u.cookie)
    expect(res.body).toMatchObject({
      title: 'keep',
      dueDate: '2026-10-15',
      priority: 'high',
      completed: true,
    })
    expect(res.body.tags).toHaveLength(1)

    const cleared = await u.client.patch(`/api/todos/${todo.body.id}`, { tagIds: [] }, u.cookie)
    expect(cleared.body.tags).toEqual([])
  })

  it('AC6.1-6.2 completes and uncompletes', async () => {
    const u = await registerUser()
    const todo = await create(u, { title: 'task' })
    const url = `/api/todos/${todo.body.id}`

    expect((await u.client.patch(url, { completed: true }, u.cookie)).body.completed).toBe(true)
    expect((await u.client.get(url, u.cookie)).body.completed).toBe(true)
    expect((await u.client.patch(url, { completed: false }, u.cookie)).body.completed).toBe(false)
  })

  it('AC12.1-12.2 moving to another day and to Unscheduled (null) persists', async () => {
    const u = await registerUser()
    const todo = await create(u, { title: 'move me', dueDate: '2026-10-13' })
    const url = `/api/todos/${todo.body.id}`

    await u.client.patch(url, { dueDate: '2026-10-16' }, u.cookie)
    expect(titles(await list(u, 'dueFrom=2026-10-16&dueTo=2026-10-16'))).toEqual(['move me'])

    const res = await u.client.patch(url, { dueDate: null }, u.cookie)
    expect(res.body.dueDate).toBeNull()
    expect(titles(await list(u, 'unscheduled=true'))).toEqual(['move me'])
  })

  it('AC13.4 rescheduling an overdue todo to today removes it from overdue', async () => {
    const u = await registerUser()
    const todo = await create(u, { title: 'late', dueDate: '2026-10-01' })

    await u.client.patch(`/api/todos/${todo.body.id}`, { dueDate: '2026-10-15' }, u.cookie)
    expect((await list(u, 'overdueBefore=2026-10-15')).body.total).toBe(0)
  })

  it('rejects invalid updates with 400 and changes nothing', async () => {
    const u = await registerUser()
    const tags: string[] = []
    for (let i = 0; i < 11; i++) {
      tags.push((await u.client.post('/api/tags', { name: `t${i}` }, u.cookie)).body.id)
    }
    const todo = await create(u, { title: 'stable' })
    const url = `/api/todos/${todo.body.id}`

    for (const bad of [
      {},
      { title: '' },
      { title: 'x'.repeat(201) },
      { completed: 'yes' },
      { priority: 'urgent' },
      { dueDate: 'tomorrow' },
      { tagIds: tags },
    ]) {
      expect((await u.client.patch(url, bad, u.cookie)).status).toBe(400)
    }
    expect((await u.client.get(url, u.cookie)).body.title).toBe('stable')
  })

  it("returns 404 when attaching someone else's tag and leaves existing tags intact", async () => {
    const a = await registerUser()
    const b = await registerUser()
    const mine = await a.client.post('/api/tags', { name: 'mine' }, a.cookie)
    const theirs = await b.client.post('/api/tags', { name: 'theirs' }, b.cookie)
    const todo = await create(a, { title: 't', tagIds: [mine.body.id] })

    const res = await a.client.patch(
      `/api/todos/${todo.body.id}`,
      { tagIds: [theirs.body.id] },
      a.cookie,
    )
    expect(res.status).toBe(404)
    expect((await a.client.get(`/api/todos/${todo.body.id}`, a.cookie)).body.tags).toHaveLength(1)
  })
})

describe('US7 Delete', () => {
  it('deletes a todo permanently', async () => {
    const u = await registerUser()
    const todo = await create(u, { title: 'bye' })

    expect((await u.client.delete(`/api/todos/${todo.body.id}`, u.cookie)).status).toBe(204)
    expect((await u.client.get(`/api/todos/${todo.body.id}`, u.cookie)).status).toBe(404)
    expect((await list(u, 'unscheduled=true')).body.total).toBe(0)
  })

  it('AC7.5 rejects a cross-origin delete with 403 and keeps the todo', async () => {
    const u = await registerUser()
    const todo = await create(u, { title: 'safe' })

    const res = await u.client.delete(`/api/todos/${todo.body.id}`, u.cookie, 'http://evil.example')
    expect(res.status).toBe(403)
    expect((await u.client.get(`/api/todos/${todo.body.id}`, u.cookie)).status).toBe(200)
  })
})

describe('Todo access control', () => {
  it('returns 401 on every todo route without a session', async () => {
    const client = api()

    expect((await client.get('/api/todos?unscheduled=true')).status).toBe(401)
    expect((await client.post('/api/todos', { title: 'a' })).status).toBe(401)
    expect((await client.get(`/api/todos/${MISSING}`)).status).toBe(401)
    expect((await client.patch(`/api/todos/${MISSING}`, { completed: true })).status).toBe(401)
    expect((await client.delete(`/api/todos/${MISSING}`)).status).toBe(401)
  })

  it("AC5.2 / AC7.4 another user's todo is 404 for read, edit and delete, and unchanged", async () => {
    const a = await registerUser()
    const b = await registerUser()
    const todo = await create(a, { title: 'private' })
    const url = `/api/todos/${todo.body.id}`

    expect((await b.client.get(url, b.cookie)).status).toBe(404)
    expect((await b.client.patch(url, { title: 'hacked' }, b.cookie)).status).toBe(404)
    expect((await b.client.delete(url, b.cookie)).status).toBe(404)
    expect((await a.client.get(url, a.cookie)).body.title).toBe('private')
  })

  it('returns 404 for malformed and unknown ids', async () => {
    const u = await registerUser()

    expect((await u.client.get('/api/todos/not-a-uuid', u.cookie)).status).toBe(404)
    expect(
      (await u.client.patch('/api/todos/not-a-uuid', { completed: true }, u.cookie)).status,
    ).toBe(404)
    expect((await u.client.delete(`/api/todos/${MISSING}`, u.cookie)).status).toBe(404)
  })
})

describe('Tags and todos together', () => {
  it('lists tags on each todo, sorted by name', async () => {
    const u = await registerUser()
    const b = await u.client.post('/api/tags', { name: 'beta' }, u.cookie)
    const a = await u.client.post('/api/tags', { name: 'Alpha' }, u.cookie)
    await create(u, { title: 't', tagIds: [b.body.id, a.body.id] })

    const res = await list(u, 'unscheduled=true')
    expect(res.body.items[0].tags.map((t: { name: string }) => t.name)).toEqual(['Alpha', 'beta'])
  })

  it('duplicate tag ids in one request are counted once', async () => {
    const u = await registerUser()
    const tag = await u.client.post('/api/tags', { name: 'x' }, u.cookie)

    const res = await create(u, { title: 't', tagIds: [tag.body.id, tag.body.id] })
    expect(res.status).toBe(201)
    expect(res.body.tags).toHaveLength(1)
  })

  it('AC8.3 deleting a tag via the API removes it from listed todos', async () => {
    const u = await registerUser()
    const tag = await u.client.post('/api/tags', { name: 'gone' }, u.cookie)
    const todo = await create(u, { title: 't', tagIds: [tag.body.id] })

    await u.client.delete(`/api/tags/${tag.body.id}`, u.cookie)
    const reloaded = await u.client.get(`/api/todos/${todo.body.id}`, u.cookie)
    expect(reloaded.status).toBe(200)
    expect(reloaded.body.tags).toEqual([])
  })
})
