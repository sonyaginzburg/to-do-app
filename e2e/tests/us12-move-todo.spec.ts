import { expect, test, openBoard, column, card, drag, saved, DAY } from '../fixtures'

test.describe('US12 Move a todo to another day', () => {
  test('AC12.1 dragging a card from Tuesday to Friday moves it, and it stays after reload', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Drag me', dueDate: DAY.tue, completed: true })
    await openBoard(page)

    await saved(page, () =>
      drag(page, card(column(page, 'Tuesday'), 'Drag me'), column(page, 'Friday')),
    )
    await expect(card(column(page, 'Friday'), 'Drag me')).toBeVisible()

    await page.reload()
    await expect(card(column(page, 'Friday'), 'Drag me')).toBeVisible()
    await expect(card(column(page, 'Tuesday'), 'Drag me')).toHaveCount(0)
  })

  test('AC12.2 dragging a card to Unscheduled clears its due date', async ({ page, api }) => {
    const todo = await api.todo({ title: 'Unschedule me', dueDate: DAY.fri })
    await openBoard(page)

    await saved(page, () =>
      drag(page, card(column(page, 'Friday'), 'Unschedule me'), column(page, 'Unscheduled')),
    )
    await expect(card(column(page, 'Unscheduled'), 'Unschedule me')).toBeVisible()

    await page.reload()
    await expect(card(column(page, 'Unscheduled'), 'Unschedule me')).toBeVisible()
    expect((await (await api.get(todo.id)).json()).dueDate).toBeNull()
  })

  test('AC12.3 the "Move to..." menu moves a card to another day, using the keyboard only', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Keyboard move', dueDate: DAY.fri })
    await openBoard(page)

    await card(page, 'Keyboard move').getByLabel('Move to: Keyboard move').focus()
    await page.keyboard.type('Sat')
    await expect(card(column(page, 'Saturday'), 'Keyboard move')).toBeVisible()
    await expect(card(column(page, 'Friday'), 'Keyboard move')).toHaveCount(0)
  })

  test('AC12.3 changing the date in the edit form moves the card (no mouse needed)', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Edit move', dueDate: DAY.fri })
    await openBoard(page)

    await card(page, 'Edit move').getByRole('button', { name: /^Edit/ }).focus()
    await page.keyboard.press('Enter')
    const form = page.getByRole('dialog')
    await form.getByLabel('Due date').fill(DAY.sun)
    await form.getByRole('button', { name: 'Save' }).press('Enter')

    await expect(card(column(page, 'Sunday'), 'Edit move')).toBeVisible()
  })

  test('AC12.4 if the server rejects the move, the card goes back and an error is shown', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Will fail', dueDate: DAY.fri })
    await openBoard(page)
    await page.route('**/api/todos/*', (route) =>
      route.request().method() === 'PATCH' ? route.abort() : route.continue(),
    )

    await card(page, 'Will fail')
      .getByLabel('Move to: Will fail')
      .selectOption({ label: 'Sunday Oct 18' })

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(card(column(page, 'Friday'), 'Will fail')).toBeVisible()
    await expect(card(column(page, 'Sunday'), 'Will fail')).toHaveCount(0)
  })

  test('AC12.5 dropping a card on Overdue returns it to its column and sends no request', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Stay put', dueDate: DAY.fri })
    const patches: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'PATCH') patches.push(r.url())
    })
    await openBoard(page)

    await drag(page, card(column(page, 'Friday'), 'Stay put'), column(page, 'Overdue'))

    await expect(card(column(page, 'Friday'), 'Stay put')).toBeVisible()
    await expect(card(column(page, 'Overdue'), 'Stay put')).toHaveCount(0)
    expect(patches).toEqual([])
  })
})
