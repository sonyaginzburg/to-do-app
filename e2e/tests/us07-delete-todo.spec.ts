import { expect, test, openBoard, card, DAY } from '../fixtures'

test.describe('US7 Delete a todo', () => {
  test('AC7.1 delete hides the todo at once and shows a 5-second Undo toast, with no confirm dialog', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Remove me', dueDate: DAY.fri })
    let dialogs = 0
    page.on('dialog', (d) => {
      dialogs++
      void d.dismiss()
    })
    await openBoard(page)

    await card(page, 'Remove me')
      .getByRole('button', { name: /^Delete/ })
      .click()

    await expect(card(page, 'Remove me')).toHaveCount(0)
    const toast = page.getByRole('status').filter({ hasText: 'Deleted' })
    await expect(toast).toContainText('Remove me')
    await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible()
    expect(dialogs).toBe(0)
  })

  test('AC7.2 clicking Undo brings the todo back and no delete request is sent', async ({
    page,
    api,
  }) => {
    const todo = await api.todo({ title: 'Keep me', dueDate: DAY.fri })
    const deletes: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'DELETE') deletes.push(r.url())
    })
    await openBoard(page)

    await card(page, 'Keep me')
      .getByRole('button', { name: /^Delete/ })
      .click()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(card(page, 'Keep me')).toBeVisible()

    await page.clock.fastForward(6000)
    await expect(card(page, 'Keep me')).toBeVisible()
    expect(deletes).toEqual([])
    expect((await api.get(todo.id)).status()).toBe(200)
  })

  test('AC7.3 after 5 seconds the delete is sent and the todo is gone, even after reload', async ({
    page,
    api,
  }) => {
    const todo = await api.todo({ title: 'Gone soon', dueDate: DAY.fri })
    await openBoard(page)

    await card(page, 'Gone soon')
      .getByRole('button', { name: /^Delete/ })
      .click()
    const sent = page.waitForResponse((r) => r.request().method() === 'DELETE')
    await page.clock.fastForward(5500)
    expect((await sent).status()).toBe(204)

    await page.reload()
    await expect(page.getByRole('region', { name: /^Thursday / })).toBeVisible()
    await expect(page.getByText('Gone soon')).toHaveCount(0)
    expect((await api.get(todo.id)).status()).toBe(404)
  })

  test("AC7.4 deleting another user's todo by id returns 404 and the todo remains", async ({
    api,
    other,
  }) => {
    const theirs = await other.todo({ title: 'Theirs' })
    expect((await api.send('DELETE', `/api/todos/${theirs.id}`)).status()).toBe(404)
    expect((await other.get(theirs.id)).status()).toBe(200)
  })

  test('AC7.5 a delete request from a different origin is rejected with 403', async ({ api }) => {
    const todo = await api.todo({ title: 'Protected' })
    const res = await api.send('DELETE', `/api/todos/${todo.id}`, undefined, 'https://evil.example')
    expect(res.status()).toBe(403)
    expect((await api.get(todo.id)).status()).toBe(200)
  })

  test('AC7.6 reloading before 5 seconds means no delete is sent and the todo is still there', async ({
    page,
    api,
  }) => {
    const todo = await api.todo({ title: 'Still here', dueDate: DAY.fri })
    await openBoard(page)

    await card(page, 'Still here')
      .getByRole('button', { name: /^Delete/ })
      .click()
    await expect(card(page, 'Still here')).toHaveCount(0)
    await page.reload()

    await expect(card(page, 'Still here')).toBeVisible()
    expect((await api.get(todo.id)).status()).toBe(200)
  })
})
