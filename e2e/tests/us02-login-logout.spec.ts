import { expect, test, openBoard, card, Api } from '../fixtures'

// AC2.5 (10 login attempts per minute) is covered by the backend tests: this stack raises that
// limit so the many tests that register users do not block each other.

test.describe('US2 Log in / log out', () => {
  test('AC2.1 correct credentials show my weekly board', async ({ page, user }) => {
    await page.context().clearCookies()
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('region', { name: 'Overdue' })).toBeVisible()
    await expect(page.getByText(user.email)).toBeVisible()
  })

  test('AC2.2 a wrong password or unknown email shows the same generic error', async ({
    page,
    user,
  }) => {
    await page.context().clearCookies()
    await page.goto('/login')

    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill('wrong-password-1')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password')

    await page.getByLabel('Email').fill('nobody-here@example.com')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
    await expect(page).toHaveURL('/login')
  })

  test('AC2.3 logging out ends the session and my todos are not shown afterwards', async ({
    page,
    api,
  }) => {
    await api.todo({ title: 'Private todo' })
    await openBoard(page)
    await expect(card(page, 'Private todo')).toBeVisible()

    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/login')

    await page.goto('/')
    await expect(page).toHaveURL('/login')
    await expect(page.getByText('Private todo')).toHaveCount(0)
  })

  test('AC2.4 asking for todos without logging in returns 401', async ({ request }) => {
    const res = await new Api(request).send('GET', '/api/todos?unscheduled=true')
    expect(res.status()).toBe(401)
  })

  test('AC2.6 using the app keeps the session cookie expiring about 7 days from now', async ({
    page,
    user,
  }) => {
    void user
    await openBoard(page)
    const sid = (await page.context().cookies()).find((c) => c.name === 'sid')
    expect(sid).toBeDefined()
    const daysLeft = (sid!.expires - Date.now() / 1000) / 86_400
    expect(daysLeft).toBeGreaterThan(6.9)
    expect(daysLeft).toBeLessThanOrEqual(7.01)
  })
})
