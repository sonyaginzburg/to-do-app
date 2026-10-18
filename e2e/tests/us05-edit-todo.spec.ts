import { expect, test, openBoard, column, card, dialog, saved, DAY } from '../fixtures'

test.describe('US5 Edit a todo', () => {
  test('AC5.1 changing title, due date, priority and tags persists after reload', async ({
    page,
    api,
  }) => {
    const school = await api.tag('school')
    await api.tag('work')
    await api.todo({ title: 'Old title', dueDate: DAY.mon, priority: 'low', tagIds: [school.id] })
    await openBoard(page)

    await card(page, 'Old title').getByRole('button', { name: /^Edit/ }).click()
    await dialog(page).getByLabel('Title', { exact: true }).fill('New title')
    await dialog(page).getByLabel('Due date', { exact: true }).fill(DAY.sat)
    await dialog(page).getByLabel('Priority', { exact: true }).selectOption('high')
    await dialog(page).getByLabel('school', { exact: true }).uncheck()
    await dialog(page).getByLabel('work', { exact: true }).check()
    await saved(page, () => dialog(page).getByRole('button', { name: 'Save' }).click())
    await expect(dialog(page)).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('region', { name: /^Thursday / })).toBeVisible()
    const item = card(column(page, 'Saturday'), 'New title')
    await expect(item).toBeVisible()
    await expect(item).toContainText('High')
    await expect(item).toContainText('work')
    await expect(item).not.toContainText('school')
    await expect(page.getByText('Old title')).toHaveCount(0)
  })

  test("AC5.2 editing another user's todo by id returns 404 and leaves it unchanged", async ({
    api,
    other,
  }) => {
    const theirs = await other.todo({ title: 'Theirs', dueDate: DAY.fri })
    const res = await api.send('PATCH', `/api/todos/${theirs.id}`, { title: 'Hacked' })
    expect(res.status()).toBe(404)

    const after = await (await other.get(theirs.id)).json()
    expect(after.title).toBe('Theirs')
  })
})
