import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { installFakeApi, type Seed } from './testing/fakeApi'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 15, 12) })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function setWidth(narrow: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: narrow,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

async function openBoard(todos: Seed[] = [], narrow = false) {
  setWidth(narrow)
  const api = installFakeApi({ todos })
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )
  await screen.findByText('sam@example.com')
  await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
  return { api, user }
}

const column = (name: RegExp | string) => screen.getByRole('region', { name })

describe('move to', () => {
  it('moves a card to another day and to Unscheduled', async () => {
    const { api, user } = await openBoard([{ title: 'Mover', dueDate: '2026-10-15' }])
    await screen.findByText('Mover')
    await user.selectOptions(screen.getByLabelText('Move to: Mover'), '2026-10-16')
    expect(await within(column(/Friday/)).findByText('Mover')).toBeInTheDocument()
    expect(api.requests.find((r) => r.method === 'PATCH')?.body).toEqual({
      dueDate: '2026-10-16',
    })
    await user.selectOptions(screen.getByLabelText('Move to: Mover'), 'none')
    expect(await within(column('Unscheduled')).findByText('Mover')).toBeInTheDocument()
    expect(api.todos[0].dueDate).toBeNull()
  })

  it('puts the card back and shows an error when the server rejects the move', async () => {
    const { api, user } = await openBoard([{ title: 'Mover', dueDate: '2026-10-15' }])
    await screen.findByText('Mover')
    api.failNextPatch()
    await user.selectOptions(screen.getByLabelText('Move to: Mover'), '2026-10-16')
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke')
    expect(within(column(/Thursday/)).getByText('Mover')).toBeInTheDocument()
    expect(within(column(/Friday/)).queryByText('Mover')).not.toBeInTheDocument()
  })
})

describe('overdue placement', () => {
  it('shows an unfinished past todo only in Overdue, not in its old day', async () => {
    await openBoard([{ title: 'Missed', dueDate: '2026-10-13' }])
    await within(column('Overdue')).findByText('Missed')
    expect(within(column(/Tuesday/)).queryByText('Missed')).not.toBeInTheDocument()
  })
})

describe('delete with undo', () => {
  it('hides the card, and Undo brings it back without a request', async () => {
    const { api, user } = await openBoard([{ title: 'Doomed', dueDate: '2026-10-15' }])
    await user.click(await screen.findByRole('button', { name: 'Delete: Doomed' }))
    expect(screen.getByText(/Deleted/)).toBeInTheDocument()
    expect(within(column(/Thursday/)).queryByRole('checkbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await within(column(/Thursday/)).findByText('Doomed')).toBeInTheDocument()
    expect(api.requests.some((r) => r.method === 'DELETE')).toBe(false)
  })

  it('sends the delete after 5 seconds', async () => {
    const { api, user } = await openBoard([{ title: 'Doomed', dueDate: '2026-10-15' }])
    await user.click(await screen.findByRole('button', { name: 'Delete: Doomed' }))
    expect(api.requests.some((r) => r.method === 'DELETE')).toBe(false)
    await waitFor(() => expect(api.requests.some((r) => r.method === 'DELETE')).toBe(true), {
      timeout: 7000,
    })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull())
    expect(api.todos).toHaveLength(0)
  }, 15000)
})

describe('narrow screens', () => {
  it('shows tabs and one column, defaulting to today', async () => {
    await openBoard([{ title: 'Today task', dueDate: '2026-10-15' }], true)
    expect(screen.getAllByRole('tab')).toHaveLength(9)
    expect(screen.getByRole('tab', { name: 'Thu' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(await screen.findByText('Today task')).toBeInTheDocument()
  })

  it('switches column when a tab is tapped and defaults to Monday in another week', async () => {
    const { user } = await openBoard([{ title: 'Idea' }], true)
    await user.click(screen.getByRole('tab', { name: 'Unscheduled' }))
    expect(await screen.findByText('Idea')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.getByRole('tab', { name: 'Mon' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the full board on wide screens', async () => {
    await openBoard()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getAllByRole('region')).toHaveLength(9)
  })

  it('keeps Move to working on narrow screens', async () => {
    const { user } = await openBoard([{ title: 'Phone', dueDate: '2026-10-15' }], true)
    await screen.findByText('Phone')
    await user.selectOptions(screen.getByLabelText('Move to: Phone'), '2026-10-16')
    await waitFor(() => expect(screen.queryByText('Phone')).not.toBeInTheDocument())
    await user.click(screen.getByRole('tab', { name: 'Fri' }))
    expect(await screen.findByText('Phone')).toBeInTheDocument()
  })
})
