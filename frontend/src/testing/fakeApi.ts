import { vi } from 'vitest'
import type { Priority, Tag, Todo } from '../todos'

// A tiny in-memory stand-in for the backend so board tests can click around like a real user.
export type Seed = {
  id?: string
  title: string
  dueDate?: string | null
  priority?: Priority
  completed?: boolean
  tagIds?: string[]
}

const ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

export function installFakeApi(seed: { todos?: Seed[]; tags?: Tag[] } = {}) {
  const tags: Tag[] = [...(seed.tags ?? [])]
  let counter = 0
  const make = (s: Seed): Todo => {
    counter += 1
    return {
      id: s.id ?? `t${counter}`,
      title: s.title.trim(),
      completed: s.completed ?? false,
      priority: s.priority ?? 'medium',
      dueDate: s.dueDate ?? null,
      tags: (s.tagIds ?? []).map((id) => tags.find((t) => t.id === id)!),
      createdAt: new Date(2026, 0, 1, 0, 0, counter).toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
  const todos: Todo[] = (seed.todos ?? []).map(make)
  const requests: { method: string; url: string; body?: Record<string, unknown> }[] = []
  let failNextPatch = false

  const reply = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status })
  const fail = (status: number, message: string, fields?: Record<string, string>) =>
    reply(status, { error: { code: 'ERR', message, fields } })

  function list(params: URLSearchParams) {
    let items = todos.filter((t) => {
      const from = params.get('dueFrom')
      const to = params.get('dueTo')
      const before = params.get('overdueBefore')
      if (from && to && !(t.dueDate && t.dueDate >= from && t.dueDate <= to)) return false
      if (params.get('unscheduled') && t.dueDate !== null) return false
      if (before && !(t.dueDate && t.dueDate < before && !t.completed)) return false
      if (params.get('completed') === 'false' && t.completed) return false
      if (params.get('priority') && t.priority !== params.get('priority')) return false
      if (params.get('tagId') && !t.tags.some((tag) => tag.id === params.get('tagId'))) return false
      return true
    })
    items = [...items].sort(
      (a, b) =>
        (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
        Number(a.completed) - Number(b.completed) ||
        ORDER[a.priority] - ORDER[b.priority] ||
        a.createdAt.localeCompare(b.createdAt),
    )
    const limit = Number(params.get('limit') ?? 50)
    const offset = Number(params.get('offset') ?? 0)
    return { items: items.slice(offset, offset + limit), total: items.length, limit, offset }
  }

  async function handle(method: string, path: string, body?: Record<string, unknown>) {
    const [route, query = ''] = path.split('?')
    const params = new URLSearchParams(query)
    const id = route.split('/')[2]

    if (route === '/auth/me') return reply(200, { id: 'u1', email: 'sam@example.com' })
    if (route === '/auth/logout') return reply(204)
    if (route === '/tags' && method === 'GET') {
      return reply(
        200,
        [...tags].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
      )
    }
    if (route === '/tags' && method === 'POST') {
      const name = String(body?.name ?? '').trim()
      if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        return fail(409, 'Tag already exists')
      }
      const tag = { id: `g${tags.length + 1}`, name }
      tags.push(tag)
      return reply(201, tag)
    }
    if (route.startsWith('/tags/') && method === 'PATCH') {
      const tag = tags.find((t) => t.id === id)!
      tag.name = String(body?.name)
      todos.forEach((t) => t.tags.forEach((x) => x.id === id && (x.name = tag.name)))
      return reply(200, tag)
    }
    if (route.startsWith('/tags/') && method === 'DELETE') {
      tags.splice(
        tags.findIndex((t) => t.id === id),
        1,
      )
      todos.forEach((t) => (t.tags = t.tags.filter((x) => x.id !== id)))
      return reply(204)
    }
    if (route === '/todos' && method === 'GET') return reply(200, list(params))
    if (route === '/todos' && method === 'POST') {
      if (String(body?.title ?? '').trim() === '') {
        return fail(400, 'Invalid input', { title: 'Title is required' })
      }
      const todo = make({
        title: String(body!.title),
        dueDate: (body!.dueDate as string | undefined) ?? null,
        priority: body!.priority as Priority | undefined,
        tagIds: body!.tagIds as string[] | undefined,
      })
      todos.push(todo)
      return reply(201, todo)
    }
    if (route.startsWith('/todos/') && method === 'DELETE') {
      const index = todos.findIndex((t) => t.id === id)
      if (index < 0) return fail(404, 'Todo not found')
      todos.splice(index, 1)
      return reply(204)
    }
    if (route.startsWith('/todos/') && method === 'PATCH') {
      if (failNextPatch) {
        failNextPatch = false
        return fail(500, 'Something broke')
      }
      const todo = todos.find((t) => t.id === id)!
      const { tagIds, ...rest } = body ?? {}
      Object.assign(todo, rest)
      if (tagIds) todo.tags = (tagIds as string[]).map((tid) => tags.find((t) => t.id === tid)!)
      return reply(200, todo)
    }
    throw new Error(`Unexpected request: ${method} ${path}`)
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const method = init.method ?? 'GET'
      const path = url.replace(/^\/api/, '')
      const body = init.body
        ? (JSON.parse(init.body as string) as Record<string, unknown>)
        : undefined
      requests.push({ method, url: path, body })
      return handle(method, path, body)
    }),
  )

  return {
    todos,
    tags,
    requests,
    failNextPatch: () => {
      failNextPatch = true
    },
  }
}
