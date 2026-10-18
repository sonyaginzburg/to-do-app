import { expect, test, openBoard, column, titles, DAY } from '../fixtures'

test.describe('US10 Order within a day', () => {
  test('AC10.1 a high-priority todo appears above a low-priority one on the same day', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Low one', dueDate: DAY.fri, priority: 'low' })
    await api.todo({ title: 'High one', dueDate: DAY.fri, priority: 'high' })
    await openBoard(page)

    await expect(titles(column(page, 'Friday'))).toHaveText(['High one', 'Low one'])
  })

  test('AC10.2 two todos with the same priority are ordered by when they were created', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Created first', dueDate: DAY.fri })
    await api.todo({ title: 'Created second', dueDate: DAY.fri })
    await openBoard(page)

    await expect(titles(column(page, 'Friday'))).toHaveText(['Created first', 'Created second'])
  })

  test('AC10.3 an incomplete todo is above a completed one, and the completed one is struck through', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Done high', dueDate: DAY.fri, priority: 'high', completed: true })
    await api.todo({ title: 'Open low', dueDate: DAY.fri, priority: 'low' })
    await openBoard(page)

    const friday = column(page, 'Friday')
    await expect(titles(friday)).toHaveText(['Open low', 'Done high'])
    await expect(titles(friday).nth(1)).toHaveCSS('text-decoration-line', 'line-through')
    await expect(titles(friday).nth(0)).not.toHaveCSS('text-decoration-line', 'line-through')
  })
})
