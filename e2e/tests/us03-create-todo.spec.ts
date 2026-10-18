import { expect, test, openBoard, column, card, dialog, DAY } from '../fixtures'

test.describe('US3 Create a todo', () => {
  test('AC3.1 a title only is created in Unscheduled, incomplete, medium priority', async ({
    page,
    api,
  }) => {
    await openBoard(page)
    await page.getByRole('button', { name: 'New todo' }).click()
    await dialog(page).getByLabel('Title', { exact: true }).fill('Buy a stapler')
    await dialog(page).getByRole('button', { name: 'Save' }).click()

    const item = card(column(page, 'Unscheduled'), 'Buy a stapler')
    await expect(item).toBeVisible()
    await expect(item).toContainText('Medium')
    await expect(item.getByRole('checkbox')).not.toBeChecked()

    const { items } = await api.list('unscheduled=true')
    expect(items).toMatchObject([{ title: 'Buy a stapler', completed: false, priority: 'medium' }])
  })

  test('AC3.2 an empty title or one over 200 characters shows an error and creates nothing', async ({
    page,
    api,
  }) => {
    await openBoard(page)
    await page.getByRole('button', { name: 'New todo' }).click()
    await dialog(page).getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('alert')).toContainText('Title is required')

    await dialog(page).getByLabel('Title', { exact: true }).fill('x'.repeat(201))
    await dialog(page).getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('alert')).toContainText('at most 200')

    expect((await api.list('unscheduled=true')).total).toBe(0)
  })

  test('AC3.3 a due date, priority and tags are all shown on the todo', async ({ page, api }) => {
    await api.tag('school')
    await api.tag('work')
    await openBoard(page)
    await page.getByRole('button', { name: 'New todo' }).click()
    await dialog(page).getByLabel('Title', { exact: true }).fill('Essay draft')
    await dialog(page).getByLabel('Due date', { exact: true }).fill(DAY.fri)
    await dialog(page).getByLabel('Priority', { exact: true }).selectOption('high')
    await dialog(page).getByLabel('school', { exact: true }).check()
    await dialog(page).getByLabel('work', { exact: true }).check()
    await dialog(page).getByRole('button', { name: 'Save' }).click()

    const item = card(column(page, 'Friday'), 'Essay draft')
    await expect(item).toBeVisible()
    await expect(item).toContainText('High')
    await expect(item).toContainText('school')
    await expect(item).toContainText('work')
  })

  test('AC3.4 selecting 11 tags is rejected with "A todo can have at most 10 tags"', async ({
    api,
  }) => {
    const tags = []
    for (let i = 1; i <= 11; i++) tags.push(await api.tag(`tag-${i}`))

    const res = await api.send('POST', '/api/todos', {
      title: 'Too many tags',
      tagIds: tags.map((t) => t.id),
    })
    expect(res.status()).toBe(400)
    expect(JSON.stringify(await res.json())).toContain('A todo can have at most 10 tags')
    expect((await api.list('unscheduled=true')).total).toBe(0)
  })

  test("AC3.5 quick-add in Friday's column creates a medium todo dated Friday with no tags", async ({
    page,
    api,
  }) => {
    await openBoard(page)
    const input = page.getByLabel('Add todo to Friday Oct 16')
    await input.fill('Pay rent')
    await input.press('Enter')

    const item = card(column(page, 'Friday'), 'Pay rent')
    await expect(item).toBeVisible()
    await expect(item).toContainText('Medium')

    const { items } = await api.list(`dueFrom=${DAY.fri}&dueTo=${DAY.fri}`)
    expect(items).toMatchObject([{ title: 'Pay rent', dueDate: DAY.fri, priority: 'medium' }])
    expect(items[0].tags).toEqual([])
  })

  test('AC3.6 quick-add in Unscheduled creates a todo with no due date', async ({ page, api }) => {
    await openBoard(page)
    const input = page.getByLabel('Add todo to Unscheduled')
    await input.fill('Someday task')
    await input.press('Enter')

    await expect(card(column(page, 'Unscheduled'), 'Someday task')).toBeVisible()
    const { items } = await api.list('unscheduled=true')
    expect(items[0].dueDate).toBeNull()
  })

  test('AC3.7 Enter in a quick-add with an empty or blank title creates nothing and shows an error', async ({
    page,
    api,
  }) => {
    await openBoard(page)
    const friday = column(page, 'Friday')
    const input = page.getByLabel('Add todo to Friday Oct 16')

    await input.press('Enter')
    await expect(friday.getByRole('alert')).toHaveText('Enter a title')

    await input.fill('   ')
    await input.press('Enter')
    await expect(friday.getByRole('alert')).toHaveText('Enter a title')

    await expect(friday.getByRole('listitem')).toHaveCount(0)
    expect((await api.list(`dueFrom=${DAY.fri}&dueTo=${DAY.fri}`)).total).toBe(0)
  })

  test('AC3.8 a due date from the form puts the card in that day, or in Overdue if it is past', async ({
    page,
    user,
  }) => {
    void user
    await openBoard(page)

    await page.getByRole('button', { name: 'New todo' }).click()
    await dialog(page).getByLabel('Title', { exact: true }).fill('Later this week')
    await dialog(page).getByLabel('Due date', { exact: true }).fill(DAY.sat)
    await dialog(page).getByRole('button', { name: 'Save' }).click()
    await expect(card(column(page, 'Saturday'), 'Later this week')).toBeVisible()

    await page.getByRole('button', { name: 'New todo' }).click()
    await dialog(page).getByLabel('Title', { exact: true }).fill('Already late')
    await dialog(page).getByLabel('Due date', { exact: true }).fill(DAY.tue)
    await dialog(page).getByRole('button', { name: 'Save' }).click()
    await expect(card(column(page, 'Overdue'), 'Already late')).toBeVisible()
  })

  test('AC3.9 the Overdue column has no quick-add input', async ({ page, user }) => {
    void user
    await openBoard(page)
    await expect(column(page, 'Overdue').getByRole('textbox')).toHaveCount(0)
    await expect(column(page, 'Friday').getByRole('textbox')).toHaveCount(1)
  })
})
