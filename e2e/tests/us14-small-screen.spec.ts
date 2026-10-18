import { expect, test, openBoard, column, card, drag, DAY } from '../fixtures'

const dayTabs = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

test.describe('US14 Use the board on a small screen', () => {
  test.describe('wide', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('AC14.1 at 900px or wider all columns are side by side with no tab bar', async ({
      page,
      user,
    }) => {
      void user
      await openBoard(page)

      await expect(page.getByRole('tablist')).toHaveCount(0)
      await expect(page.getByRole('region')).toHaveCount(9)
      const monday = (await column(page, 'Monday').boundingBox())!
      const sunday = (await column(page, 'Sunday').boundingBox())!
      expect(sunday.x).toBeGreaterThan(monday.x)
      expect(Math.abs(sunday.y - monday.y)).toBeLessThan(2)
    })
  })

  test.describe('at exactly 900px', () => {
    test.use({ viewport: { width: 900, height: 800 } })

    test('AC14.1 900px still uses the side-by-side layout', async ({ page, user }) => {
      void user
      await openBoard(page)
      await expect(page.getByRole('tablist')).toHaveCount(0)
      await expect(page.getByRole('region')).toHaveCount(9)
    })
  })

  test.describe('narrow', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('AC14.2 below 900px a tab bar shows one column, defaulting to today', async ({
      page,
      user,
    }) => {
      void user
      await openBoard(page)

      const tabs = page.getByRole('tablist', { name: 'Columns' }).getByRole('tab')
      await expect(tabs).toHaveText(['Overdue', ...dayTabs, 'Unscheduled'])
      await expect(page.getByRole('region')).toHaveCount(1)
      await expect(page.getByRole('tab', { name: 'Thu' })).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByRole('region', { name: 'Thursday Oct 15' })).toBeVisible()
    })

    test('AC14.2 in a week that does not contain today, the default tab is Monday', async ({
      page,
      user,
    }) => {
      void user
      await openBoard(page)
      await page.getByRole('button', { name: 'Next week' }).click()

      await expect(page.getByRole('tab', { name: 'Mon' })).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByRole('region', { name: 'Monday Oct 19' })).toBeVisible()
    })

    test("AC14.3 tapping a tab shows that column's todos", async ({ page, api }) => {
      await api.todo({ title: 'Friday task', dueDate: DAY.fri })
      await api.todo({ title: 'Unscheduled task' })
      await api.todo({ title: 'Late task', dueDate: DAY.mon })
      await openBoard(page)
      await expect(page.getByText('Friday task')).toHaveCount(0)

      await page.getByRole('tab', { name: 'Fri' }).click()
      await expect(card(column(page, 'Friday'), 'Friday task')).toBeVisible()

      await page.getByRole('tab', { name: 'Unscheduled' }).click()
      await expect(card(column(page, 'Unscheduled'), 'Unscheduled task')).toBeVisible()

      await page.getByRole('tab', { name: 'Overdue' }).click()
      await expect(card(column(page, 'Overdue'), 'Late task')).toBeVisible()
    })

    test('AC14.4 drag and drop is off, and "Move to..." still works', async ({ page, api }) => {
      await api.todo({ title: 'Phone move', dueDate: DAY.thu })
      await openBoard(page)

      const item = card(column(page, 'Thursday'), 'Phone move')
      await expect(item).toBeVisible()
      // Dragging the card does nothing on a narrow screen: there is no other column to drop on,
      // and the card does not follow the pointer.
      const before = (await item.boundingBox())!
      await drag(page, item, page.getByRole('tablist'))
      expect(await item.boundingBox()).toEqual(before)

      await item.getByLabel('Move to: Phone move').selectOption({ label: 'Saturday Oct 17' })
      await expect(page.getByText('Phone move')).toHaveCount(0)
      await page.getByRole('tab', { name: 'Sat' }).click()
      await expect(card(column(page, 'Saturday'), 'Phone move')).toBeVisible()
    })
  })
})
