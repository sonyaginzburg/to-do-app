import { expect, test, openBoard, card, saved } from '../fixtures'

test.describe('US6 Complete / uncomplete', () => {
  test('AC6.1 ticking a todo completes it and it stays complete after reload', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Finish report' })
    await openBoard(page)

    const box = card(page, 'Finish report').getByRole('checkbox')
    await saved(page, () => box.click())
    await expect(box).toBeChecked()

    await page.reload()
    await expect(card(page, 'Finish report').getByRole('checkbox')).toBeChecked()
  })

  test('AC6.2 unticking a completed todo makes it incomplete again', async ({ page, api }) => {
    await api.todo({ title: 'Finish report', completed: true })
    await openBoard(page)

    const box = card(page, 'Finish report').getByRole('checkbox')
    await expect(box).toBeChecked()
    await saved(page, () => box.click())
    await expect(box).not.toBeChecked()

    await page.reload()
    await expect(card(page, 'Finish report').getByRole('checkbox')).not.toBeChecked()
  })
})
