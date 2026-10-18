import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

type Reply = { status: number; body?: unknown }
let routes: Record<string, Reply | (() => Reply)>
let calls: { key: string; body: unknown; init: RequestInit }[]

const json = (status: number, body?: unknown): Reply => ({ status, body })
const error = (status: number, code: string, message: string, fields?: object) =>
  json(status, { error: { code, message, fields } })

beforeEach(() => {
  calls = []
  routes = {}
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const key = `${init.method} ${url}`
      calls.push({ key, body: init.body ? JSON.parse(init.body as string) : undefined, init })
      const entry = routes[key]
      if (!entry) throw new Error(`Unexpected request: ${key}`)
      const { status, body } = typeof entry === 'function' ? entry() : entry
      return new Response(body === undefined ? null : JSON.stringify(body), { status })
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

const loggedOut = () =>
  (routes['GET /api/auth/me'] = error(401, 'UNAUTHENTICATED', 'Please log in'))
const loggedIn = () =>
  (routes['GET /api/auth/me'] = json(200, { id: 'u1', email: 'sam@example.com' }))

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

describe('route guard', () => {
  it('sends a logged-out visitor from the board to the login page', async () => {
    loggedOut()
    open('/')
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('sends a logged-in user away from login and register to the board', async () => {
    loggedIn()
    open('/login')
    expect(await screen.findByText('sam@example.com')).toBeInTheDocument()
  })

  it('shows a message when the server cannot be reached instead of redirecting', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    open('/')
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i)
  })

  it('treats an unknown address as the board', async () => {
    loggedIn()
    open('/nowhere')
    expect(await screen.findByText('sam@example.com')).toBeInTheDocument()
  })
})

describe('US1 Register', () => {
  it('AC1.1 creates the account and lands on the board', async () => {
    loggedOut()
    routes['POST /api/auth/register'] = json(201, { id: 'u1', email: 'new@example.com' })
    open('/register')

    await userEvent.type(await screen.findByLabelText('Email'), 'new@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('new@example.com')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/auth/register')?.body).toEqual({
      email: 'new@example.com',
      password: 'correct horse',
    })
  })

  it('AC1.2 shows "Email already in use" on the email field', async () => {
    loggedOut()
    routes['POST /api/auth/register'] = error(409, 'CONFLICT', 'Email already registered')
    open('/register')

    await userEvent.type(await screen.findByLabelText('Email'), 'taken@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Email already in use')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('AC1.3 shows the server validation message under each field', async () => {
    loggedOut()
    routes['POST /api/auth/register'] = error(400, 'VALIDATION_ERROR', 'Invalid input', {
      email: 'Enter a valid email address',
      password: 'Password must be at least 8 characters',
    })
    open('/register')

    await userEvent.type(await screen.findByLabelText('Email'), 'nope')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })

  it('links to the login page', async () => {
    loggedOut()
    open('/register')
    await userEvent.click(await screen.findByRole('link', { name: 'Log in' }))
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })
})

describe('US2 Log in / log out', () => {
  it('AC2.1 correct credentials show the board', async () => {
    loggedOut()
    routes['POST /api/auth/login'] = json(200, { id: 'u1', email: 'sam@example.com' })
    open('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'sam@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('sam@example.com')).toBeInTheDocument()
  })

  it('AC2.2 wrong credentials show one generic error and stay on the page', async () => {
    loggedOut()
    routes['POST /api/auth/login'] = error(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    open('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'sam@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong password')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('shows a friendly message when rate limited (429)', async () => {
    loggedOut()
    routes['POST /api/auth/login'] = error(429, 'RATE_LIMITED', 'Too many attempts')
    open('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'sam@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i)
  })

  it('AC2.3 logging out ends the session and returns to the login page', async () => {
    loggedIn()
    routes['POST /api/auth/logout'] = json(204)
    open('/')

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /api/auth/logout')).toBe(true)
    expect(screen.queryByText('sam@example.com')).not.toBeInTheDocument()
  })

  it('logging out with an already-expired session still ends at the login page', async () => {
    loggedIn()
    routes['POST /api/auth/logout'] = error(401, 'UNAUTHENTICATED', 'Please log in')
    open('/')

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('disables the button while the request is in flight', async () => {
    loggedOut()
    let release!: () => void
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url) === '/api/auth/me') {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 })
      }
      expect(init?.method).toBe('POST')
      await new Promise<void>((resolve) => (release = resolve))
      return new Response(JSON.stringify({ id: 'u1', email: 'sam@example.com' }), { status: 200 })
    })
    open('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'sam@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('button', { name: 'Logging in…' })).toBeDisabled()
    release()
    await waitFor(() => expect(screen.getByText('sam@example.com')).toBeInTheDocument())
  })
})
