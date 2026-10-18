import { expect, test, openBoard, column, card, dialog } from '../fixtures'

test.describe('US8 Manage tags', () => {
  test('AC8.1 a tag I create can be attached to my todos', async ({ page, user }) => {
    void user
    await openBoard(page)
    await page.getByRole('button', { name: 'Manage tags' }).click()
    await dialog(page).getByLabel('New tag').fill('school')
    await dialog(page).getByRole('button', { name: 'Add tag' }).click()
    await expect(dialog(page).getByRole('listitem').filter({ hasText: 'school' })).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Close' }).click()

    await page.getByRole('button', { name: 'New todo' }).click()
    await dialog(page).getByLabel('Title', { exact: true }).fill('Read chapter 4')
    await dialog(page).getByLabel('school', { exact: true }).check()
    await dialog(page).getByRole('button', { name: 'Save' }).click()
    await expect(card(column(page, 'Unscheduled'), 'Read chapter 4')).toContainText('school')
  })

  test('AC8.2 creating the same tag again in any case shows a duplicate error', async ({
    page,
    api,
  }) => {
    await api.tag('school')
    await openBoard(page)
    await page.getByRole('button', { name: 'Manage tags' }).click()
    await dialog(page).getByLabel('New tag').fill('SCHOOL')
    await dialog(page).getByRole('button', { name: 'Add tag' }).click()

    await expect(dialog(page).getByRole('alert')).toHaveText('Tag already exists')
    await expect(dialog(page).getByRole('listitem')).toHaveCount(1)
  })

  test('AC8.3 deleting a tag removes it from its todos but keeps the todos', async ({
    page,
    api,
  }) => {
    const school = await api.tag('school')
    await api.todo({ title: 'Homework', tagIds: [school.id] })
    await api.todo({ title: 'Reading', tagIds: [school.id] })
    await openBoard(page)
    await expect(card(page, 'Homework')).toContainText('school')

    await page.getByRole('button', { name: 'Manage tags' }).click()
    await dialog(page).getByRole('button', { name: 'Delete school' }).click()
    await expect(dialog(page).getByText('No tags yet.').first()).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Close' }).click()

    await expect(card(page, 'Homework')).toBeVisible()
    await expect(card(page, 'Reading')).toBeVisible()
    await expect(card(page, 'Homework')).not.toContainText('school')
    await expect(card(page, 'Reading')).not.toContainText('school')
  })

  test('AC8.4 another user having "school" does not stop me creating my own', async ({
    page,
    user,
    other,
  }) => {
    void user
    await other.tag('school')
    await openBoard(page)
    await page.getByRole('button', { name: 'Manage tags' }).click()
    await dialog(page).getByLabel('New tag').fill('school')
    await dialog(page).getByRole('button', { name: 'Add tag' }).click()

    await expect(dialog(page).getByRole('listitem').filter({ hasText: 'school' })).toBeVisible()
    await expect(dialog(page).getByRole('alert')).toHaveCount(0)
  })

  test('AC8.5 a tag name over 30 characters is rejected and no tag is created', async ({
    page,
    user,
    api,
  }) => {
    void user
    await openBoard(page)
    await page.getByRole('button', { name: 'Manage tags' }).click()
    await dialog(page).getByLabel('New tag').fill('t'.repeat(31))
    await dialog(page).getByRole('button', { name: 'Add tag' }).click()

    await expect(dialog(page).getByRole('alert')).toContainText('at most 30')
    const res = await api.send('GET', '/api/tags')
    expect(await res.json()).toEqual([])
  })
})
