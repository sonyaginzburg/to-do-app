import {
  expect,
  test,
  openBoard,
  column,
  card,
  tagFilter,
  priorityFilter,
  DAY,
  type Api,
} from '../fixtures'

// Todos spread over several days, with mixed priority, completion and tags.
async function seed(api: Api) {
  const school = await api.tag('school')
  const work = await api.tag('work')
  await api.todo({ title: 'Essay', dueDate: DAY.fri, priority: 'high', tagIds: [school.id] })
  await api.todo({ title: 'Report', dueDate: DAY.fri, priority: 'high', tagIds: [work.id] })
  await api.todo({ title: 'Laundry', dueDate: DAY.sat, priority: 'low' })
  await api.todo({ title: 'Call mum', dueDate: DAY.sat, priority: 'medium', tagIds: [school.id] })
  await api.todo({ title: 'Old chore', dueDate: DAY.mon, priority: 'high', completed: true })
  await api.todo({ title: 'Someday', priority: 'high' })
}

test.describe('US9 Filter', () => {
  test('AC9.1 filtering by high priority shows only high-priority todos in every column', async ({
    page,
    api,
  }) => {
    await seed(api)
    await openBoard(page)
    await priorityFilter(page).selectOption('high')

    for (const name of ['Essay', 'Report', 'Old chore', 'Someday']) {
      await expect(card(page, name)).toBeVisible()
    }
    for (const name of ['Laundry', 'Call mum']) {
      await expect(card(page, name)).toHaveCount(0)
    }
  })

  test('AC9.2 Hide completed removes completed todos from every column', async ({ page, api }) => {
    await seed(api)
    await openBoard(page)
    await expect(card(column(page, 'Monday'), 'Old chore')).toBeVisible()

    await page.getByLabel('Hide completed').check()
    await expect(card(page, 'Old chore')).toHaveCount(0)
    await expect(card(page, 'Essay')).toBeVisible()
  })

  test('AC9.3 filtering by a tag shows only todos with that tag', async ({ page, api }) => {
    await seed(api)
    await openBoard(page)
    await tagFilter(page).selectOption({ label: 'school' })

    await expect(card(page, 'Essay')).toBeVisible()
    await expect(card(page, 'Call mum')).toBeVisible()
    for (const name of ['Report', 'Laundry', 'Old chore', 'Someday']) {
      await expect(card(page, name)).toHaveCount(0)
    }
  })

  test('AC9.4 a tag and a priority together show only todos matching both', async ({
    page,
    api,
  }) => {
    await seed(api)
    await openBoard(page)
    await tagFilter(page).selectOption({ label: 'school' })
    await priorityFilter(page).selectOption('high')

    await expect(card(page, 'Essay')).toBeVisible()
    for (const name of ['Call mum', 'Report', 'Laundry', 'Old chore', 'Someday']) {
      await expect(card(page, name)).toHaveCount(0)
    }
  })

  test('AC9.5 a filter stays on the next week, shows chips, and Clear filters removes it', async ({
    page,
    api,
  }) => {
    await seed(api)
    await openBoard(page)
    await tagFilter(page).selectOption({ label: 'school' })
    const chips = page.getByRole('list', { name: 'Active filters' })
    await expect(chips).toContainText('Tag: school')

    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(page.getByRole('region', { name: /^Monday Oct 19/ })).toBeVisible()
    await expect(chips).toContainText('Tag: school')
    await expect(tagFilter(page)).toHaveValue(/.+/)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(chips).toHaveCount(0)
    await expect(tagFilter(page)).toHaveValue('')
  })

  test('AC9.6 a filter that matches nothing shows a message with a Clear filters button', async ({
    page,
    api,
  }) => {
    await seed(api)
    await openBoard(page)
    await tagFilter(page).selectOption({ label: 'school' })
    await priorityFilter(page).selectOption('low')

    const banner = page.getByRole('status').filter({ hasText: 'No todos match your filters' })
    await expect(banner).toBeVisible()
    await banner.getByRole('button', { name: 'Clear filters' }).click()
    await expect(banner).toHaveCount(0)
    await expect(card(page, 'Essay')).toBeVisible()
  })
})
