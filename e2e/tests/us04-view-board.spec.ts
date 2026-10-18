import { type Page } from '@playwright/test'
import { expect, test, openBoard, column, card, DAY } from '../fixtures'

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const dates = Object.values(DAY)

test.describe('US4 View my weekly board', () => {
  // Days before today only show an unfinished todo in Overdue (US13), so the Mon to Wed todos
  // here are completed; they then stay in their own day column (AC13.2).
  test('AC4.1 each todo appears in its day column and today is highlighted', async ({
    page,
    api,
  }) => {
    for (const [i, date] of dates.entries()) {
      await api.todo({ title: `${dayNames[i]} item`, dueDate: date, completed: date < DAY.thu })
    }
    await openBoard(page)

    for (const name of dayNames) {
      await expect(card(column(page, name), `${name} item`)).toBeVisible()
      await expect(column(page, name).getByRole('listitem')).toHaveCount(1)
    }
    const thursday = column(page, 'Thursday')
    await expect(thursday).toHaveAttribute('aria-current', 'date')
    await expect(thursday.getByText('Today')).toBeVisible()
    await expect(column(page, 'Friday')).not.toHaveAttribute('aria-current', 'date')
  })

  test('AC4.2 I only see my own todos', async ({ page, api, other }) => {
    await api.todo({ title: 'Mine', dueDate: DAY.fri })
    await other.todo({ title: 'Theirs', dueDate: DAY.fri })
    await openBoard(page)

    await expect(card(page, 'Mine')).toBeVisible()
    await expect(page.getByText('Theirs')).toHaveCount(0)
  })

  test('AC4.3 a todo with no due date appears in Unscheduled', async ({ page, api }) => {
    await api.todo({ title: 'No date' })
    await openBoard(page)
    await expect(card(column(page, 'Unscheduled'), 'No date')).toBeVisible()
  })

  test('AC4.4 25 overdue todos come back as 20 with total 25, then the remaining 5', async ({
    api,
  }) => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => api.todo({ title: `Late ${i}`, dueDate: DAY.mon })),
    )
    const first = await api.list(`overdueBefore=${DAY.thu}&limit=20`)
    expect(first.items).toHaveLength(20)
    expect(first.total).toBe(25)

    const rest = await api.list(`overdueBefore=${DAY.thu}&limit=20&offset=20`)
    expect(rest.items).toHaveLength(5)
  })

  test('AC4.5 a list request with no scope, or with two scopes, returns 400', async ({ api }) => {
    expect((await api.send('GET', '/api/todos')).status()).toBe(400)
    const two = await api.send('GET', `/api/todos?unscheduled=true&overdueBefore=${DAY.thu}`)
    expect(two.status()).toBe(400)
  })

  test('AC4.6 with no todos I see empty columns with a helpful message', async ({ page, user }) => {
    void user
    await openBoard(page)
    await expect(page.getByText('No todos. Add one below.')).toHaveCount(8)
    await expect(column(page, 'Overdue')).toContainText('Nothing overdue.')
  })

  test('AC4.7 a brand-new user sees a first-todo hint that disappears once they add one', async ({
    page,
    user,
  }) => {
    void user
    await openBoard(page)
    const hint = page.getByText('Add your first todo to any day')
    await expect(hint).toBeVisible()

    await addViaQuickAdd(page, 'Monday Oct 12', 'First one')
    await expect(card(page, 'First one')).toBeVisible()
    await expect(hint).toHaveCount(0)
  })
})

async function addViaQuickAdd(page: Page, columnLabel: string, title: string) {
  const input = page.getByLabel(`Add todo to ${columnLabel}`)
  await input.fill(title)
  await input.press('Enter')
}
