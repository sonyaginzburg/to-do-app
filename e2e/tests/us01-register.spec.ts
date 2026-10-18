import { expect, test, uniqueEmail, PASSWORD, Api } from '../fixtures'

test.describe('US1 Register', () => {
  test('AC1.1 a new email and valid password creates an account and logs me in', async ({
    page,
  }) => {
    await page.goto('/register')
    await page.getByLabel('Email').fill(uniqueEmail())
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
  })

  test('AC1.2 registering an email that is already used shows "email already in use"', async ({
    page,
    user,
  }) => {
    await page.context().clearCookies()
    await page.goto('/register')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('Email already in use')).toBeVisible()
    await expect(page).toHaveURL('/register')
  })

  test('AC1.3 an invalid email or a short password shows an error and creates no account', async ({
    page,
    request,
  }) => {
    await page.goto('/register')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert')).toContainText('valid email')

    const email = uniqueEmail()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert')).toContainText('at least 8 characters')
    await expect(page).toHaveURL('/register')

    // No account was created for that email, so logging in with it fails.
    const login = await new Api(request).send('POST', '/api/auth/login', {
      email,
      password: 'short',
    })
    expect(login.status()).toBe(401)
  })
})
