import { expect, test, openBoard, column, card, saved, DAY } from '../fixtures'

test.describe('US13 Handle overdue todos', () => {
  test('AC13.1 an unfinished todo due before today appears in Overdue for any week, not in its old day', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Late one', dueDate: DAY.tue })
    await openBoard(page)

    await expect(card(column(page, 'Overdue'), 'Late one')).toBeVisible()
    await expect(card(column(page, 'Tuesday'), 'Late one')).toHaveCount(0)

    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(page.getByRole('region', { name: 'Monday Oct 19' })).toBeVisible()
    await expect(card(column(page, 'Overdue'), 'Late one')).toBeVisible()
  })

  test('AC13.2 a completed todo due before today is not in Overdue and stays in its day', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Finished', dueDate: DAY.tue, completed: true })
    await openBoard(page)

    await expect(card(column(page, 'Tuesday'), 'Finished')).toBeVisible()
    await expect(card(column(page, 'Overdue'), 'Finished')).toHaveCount(0)
  })

  test('AC13.3 a todo due today is not overdue', async ({ page, api }) => {
    await api.todo({ title: 'Due today', dueDate: DAY.thu })
    await openBoard(page)

    await expect(card(column(page, 'Thursday'), 'Due today')).toBeVisible()
    await expect(card(column(page, 'Overdue'), 'Due today')).toHaveCount(0)
  })

  test('AC13.4 "Reschedule to today" moves a todo to today and it stays there after reload', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Catch up', dueDate: DAY.mon })
    await openBoard(page)

    await saved(page, () =>
      card(column(page, 'Overdue'), 'Catch up')
        .getByRole('button', { name: /^Reschedule to today/ })
        .click(),
    )
    await expect(card(column(page, 'Thursday'), 'Catch up')).toBeVisible()
    await expect(card(column(page, 'Overdue'), 'Catch up')).toHaveCount(0)

    await page.reload()
    await expect(card(column(page, 'Thursday'), 'Catch up')).toBeVisible()
    await expect(card(column(page, 'Overdue'), 'Catch up')).toHaveCount(0)
  })

  test('AC13.5 the overdue todo with the oldest due date is on top', async ({ page, api }) => {
    await api.todo({ title: 'Due Oct 10', dueDate: '2026-10-10' })
    await api.todo({ title: 'Due Oct 5', dueDate: '2026-10-05' })
    await api.todo({ title: 'Due Oct 12', dueDate: DAY.mon })
    await openBoard(page)

    const items = column(page, 'Overdue').getByRole('listitem')
    await expect(items).toHaveCount(3)
    await expect(items.nth(0)).toContainText('Due Oct 5')
    await expect(items.nth(1)).toContainText('Due Oct 10')
    await expect(items.nth(2)).toContainText('Due Oct 12')
  })
})
