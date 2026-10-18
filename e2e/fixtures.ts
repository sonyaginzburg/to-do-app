import { randomUUID } from 'node:crypto'
import {
  test as base,
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test'

export { expect }

export const ORIGIN = process.env.BASE_URL ?? 'http://localhost:8080'
export const PASSWORD = 'correct-horse-1'

// Every test pretends it is Thursday 15 Oct 2026, so the visible week is Mon 12 to Sun 18 Oct.
export const NOW = '2026-10-15T12:00:00Z'
export const DAY = {
  mon: '2026-10-12',
  tue: '2026-10-13',
  wed: '2026-10-14',
  thu: '2026-10-15',
  fri: '2026-10-16',
  sat: '2026-10-17',
  sun: '2026-10-18',
} as const

export type Priority = 'low' | 'medium' | 'high'
export type TodoInput = {
  title: string
  dueDate?: string | null
  priority?: Priority
  tagIds?: string[]
}
export type TodoDto = {
  id: string
  title: string
  completed: boolean
  priority: Priority
  dueDate: string | null
  tags: { id: string; name: string }[]
}
export type TagDto = { id: string; name: string }

export const uniqueEmail = () => `e2e-${randomUUID()}@example.com`

// A small client for the API, used to set data up quickly and to check what the server holds.
export class Api {
  constructor(private request: APIRequestContext) {}

  send(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, data?: unknown, origin = ORIGIN) {
    return this.request.fetch(path, { method, data, headers: { Origin: origin } })
  }

  async register(email: string, password = PASSWORD) {
    const res = await this.send('POST', '/api/auth/register', { email, password })
    expect(res.status()).toBe(201)
  }

  async todo(input: TodoInput & { completed?: boolean }): Promise<TodoDto> {
    const { completed, ...body } = input
    const res = await this.send('POST', '/api/todos', body)
    expect(res.status()).toBe(201)
    const todo = (await res.json()) as TodoDto
    if (!completed) return todo
    const done = await this.send('PATCH', `/api/todos/${todo.id}`, { completed: true })
    expect(done.status()).toBe(200)
    return (await done.json()) as TodoDto
  }

  async tag(name: string): Promise<TagDto> {
    const res = await this.send('POST', '/api/tags', { name })
    expect(res.status()).toBe(201)
    return (await res.json()) as TagDto
  }

  async list(query: string) {
    const res = await this.send('GET', `/api/todos?${query}`)
    expect(res.status()).toBe(200)
    return (await res.json()) as { items: TodoDto[]; total: number }
  }

  async get(id: string) {
    return this.send('GET', `/api/todos/${id}`)
  }
}

type Fixtures = {
  user: { email: string; password: string }
  api: Api
  // A second, separate user with their own cookies (for "other user" criteria)
  other: Api
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await page.clock.install({ time: new Date(NOW) })
    await use(page)
  },
  // Registers a brand-new user. The API sets the session cookie, so the page is already logged in.
  user: async ({ page }, use) => {
    const email = uniqueEmail()
    await new Api(page.request).register(email)
    await use({ email, password: PASSWORD })
  },
  api: async ({ page, user }, use) => {
    void user
    await use(new Api(page.request))
  },
  other: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({ baseURL })
    const api = new Api(context)
    await api.register(uniqueEmail())
    await use(api)
    await context.dispose()
  },
})

export async function openBoard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('region', { name: /^Thursday / })).toBeVisible()
  // The board shows "Loading…" in each column until its first fetch finishes.
  await expect(page.getByText('Loading…')).toHaveCount(0)
}

// Columns are regions named after the day ("Friday Oct 16"), "Overdue" or "Unscheduled".
export const column = (page: Page, name: string): Locator =>
  page.getByRole('region', { name: name.length > 3 ? new RegExp(`^${name}( |$)`) : name })

export const card = (scope: Locator | Page, title: string): Locator =>
  scope.getByRole('listitem').filter({ hasText: title })

// The Tag and Priority drop-downs above the board
export const tagFilter = (page: Page): Locator => page.getByRole('combobox', { name: /^Tag/ })
export const priorityFilter = (page: Page): Locator =>
  page.getByRole('combobox', { name: /^Priority/ })

// The New/Edit todo and Manage tags pop-ups
export const dialog = (page: Page): Locator => page.getByRole('dialog')

export const titles = (col: Locator) => col.getByRole('listitem').locator('[class*="title"]')

// Runs an action and waits until the server has answered the change it makes, so a following
// reload cannot cancel the request half-way.
export async function saved(page: Page, action: () => Promise<unknown>) {
  const done = page.waitForResponse(
    (r) => r.url().includes('/api/') && ['POST', 'PATCH', 'DELETE'].includes(r.request().method()),
  )
  await action()
  await done
}

// Mouse drag that dnd-kit's pointer sensor accepts (it needs a few small moves first).
export async function drag(page: Page, from: Locator, to: Locator) {
  await to.scrollIntoViewIfNeeded()
  await from.scrollIntoViewIfNeeded()
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + 10)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + 20, { steps: 3 })
  const tx = b.x + b.width / 2
  const ty = b.y + Math.min(60, b.height / 2)
  await page.mouse.move(tx, ty, { steps: 25 })
  await page.mouse.move(tx + 2, ty + 2, { steps: 3 })
  await page.waitForTimeout(100)
  await page.mouse.up()
}
