import { expect, test, openBoard, column, card, DAY } from '../fixtures'

const range = (page: import('@playwright/test').Page) =>
  page.getByRole('group', { name: 'Week navigation' })

test.describe('US11 Navigate weeks', () => {
  test('AC11.1 Next week shows the following Mon to Sun; Overdue and Unscheduled are unchanged', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Late', dueDate: DAY.mon })
    await api.todo({ title: 'No date' })
    await api.todo({ title: 'Next Tuesday', dueDate: '2026-10-20' })
    await openBoard(page)
    await expect(range(page)).toContainText('Oct 12 – Oct 18, 2026')

    await page.getByRole('button', { name: 'Next week' }).click()

    await expect(range(page)).toContainText('Oct 19 – Oct 25, 2026')
    await expect(page.getByRole('region', { name: 'Monday Oct 19' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Sunday Oct 25' })).toBeVisible()
    await expect(card(column(page, 'Tuesday'), 'Next Tuesday')).toBeVisible()
    await expect(card(column(page, 'Overdue'), 'Late')).toBeVisible()
    await expect(card(column(page, 'Unscheduled'), 'No date')).toBeVisible()
  })

  test('AC11.2 Previous week shows the previous Mon to Sun', async ({ page, user }) => {
    void user
    await openBoard(page)
    await page.getByRole('button', { name: 'Previous week' }).click()

    await expect(range(page)).toContainText('Oct 5 – Oct 11, 2026')
    await expect(page.getByRole('region', { name: 'Monday Oct 5' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Sunday Oct 11' })).toBeVisible()
  })

  test('AC11.3 This week returns to the current week with today highlighted', async ({
    page,
    user,
  }) => {
    void user
    await openBoard(page)
    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(page.getByRole('region', { name: /^Thursday Oct 22/ })).not.toHaveAttribute(
      'aria-current',
      'date',
    )

    await page.getByRole('button', { name: 'This week' }).click()
    await expect(range(page)).toContainText('Oct 12 – Oct 18, 2026')
    await expect(page.getByRole('region', { name: 'Thursday Oct 15' })).toHaveAttribute(
      'aria-current',
      'date',
    )
  })

  test('AC11.4 the week of Oct 12 includes Sunday Oct 18 but not Monday Oct 19', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Sunday todo', dueDate: DAY.sun })
    await api.todo({ title: 'Monday todo', dueDate: '2026-10-19' })
    await openBoard(page)

    await expect(card(column(page, 'Sunday'), 'Sunday todo')).toBeVisible()
    await expect(page.getByText('Monday todo')).toHaveCount(0)
  })
})
