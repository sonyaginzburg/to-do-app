import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { installFakeApi, type Seed } from './testing/fakeApi'

// Thursday 15 Oct 2026. Only Date is faked so timers and waitFor keep working.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 15, 12) })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const TAGS = [
  { id: 'g1', name: 'Work' },
  { id: 'g2', name: 'Home' },
]

async function openBoard(todos: Seed[] = [], tags = TAGS) {
  const api = installFakeApi({ todos, tags })
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

describe('board layout', () => {
  it('shows Overdue, Monday to Sunday and Unscheduled, and highlights today', async () => {
    await openBoard()
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(names).toEqual([
      'Overdue',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
      'Unscheduled',
    ])
    expect(column(/Thursday/)).toHaveAttribute('aria-current', 'date')
    expect(column(/Friday/)).not.toHaveAttribute('aria-current')
  })

  it('puts todos in the right column, with friendly empty text', async () => {
    await openBoard([
      { title: 'Dentist', dueDate: '2026-10-16' },
      { title: 'Someday', dueDate: null },
      { title: 'Late one', dueDate: '2026-10-10' },
    ])
    expect(await within(column(/Friday/)).findByText('Dentist')).toBeInTheDocument()
    expect(within(column('Unscheduled')).getByText('Someday')).toBeInTheDocument()
    expect(within(column('Overdue')).getByText('Late one')).toBeInTheDocument()
    expect(within(column(/Monday/)).getByText('No todos. Add one below.')).toBeInTheDocument()
  })

  it('says nothing is overdue when nothing is', async () => {
    await openBoard([{ title: 'Fine', dueDate: '2026-10-16' }])
    expect(within(column('Overdue')).getByText('Nothing overdue.')).toBeInTheDocument()
  })

  it('invites the user to add a first todo on an empty board', async () => {
    await openBoard()
    expect(screen.getByText('Add your first todo to any day.')).toBeInTheDocument()
  })

  it('shows priority as text and strikes through completed titles', async () => {
    await openBoard([
      { title: 'Big', dueDate: '2026-10-15', priority: 'high' },
      { title: 'Done', dueDate: '2026-10-15', completed: true },
    ])
    const thursday = column(/Thursday/)
    expect(await within(thursday).findByText('High')).toBeInTheDocument()
    expect(within(thursday).getByRole('checkbox', { name: 'Complete "Done"' })).toBeChecked()
  })

  it('orders by incomplete first, then priority', async () => {
    await openBoard([
      { title: 'Low one', dueDate: '2026-10-15', priority: 'low' },
      { title: 'Finished', dueDate: '2026-10-15', priority: 'high', completed: true },
      { title: 'High one', dueDate: '2026-10-15', priority: 'high' },
    ])
    await screen.findByText('High one')
    const order = within(column(/Thursday/))
      .getAllByRole('checkbox')
      .map((c) => c.getAttribute('aria-label'))
    expect(order).toEqual(['Complete "High one"', 'Complete "Low one"', 'Complete "Finished"'])
  })
})

describe('quick add', () => {
  it('creates a todo with the column date on Enter', async () => {
    const { api, user } = await openBoard()
    await user.type(screen.getByLabelText('Add todo to Friday Oct 16'), 'Buy milk{Enter}')
    expect(await within(column(/Friday/)).findByText('Buy milk')).toBeInTheDocument()
    const post = api.requests.find((r) => r.method === 'POST' && r.url === '/todos')
    expect(post?.body).toMatchObject({ title: 'Buy milk', dueDate: '2026-10-16' })
  })

  it('adds to Unscheduled without a date', async () => {
    const { api, user } = await openBoard()
    await user.type(screen.getByLabelText('Add todo to Unscheduled'), 'Idea{Enter}')
    expect(await within(column('Unscheduled')).findByText('Idea')).toBeInTheDocument()
    const post = api.requests.find((r) => r.method === 'POST')
    expect(post?.body?.dueDate).toBeUndefined()
  })

  it('rejects an empty title without calling the server', async () => {
    const { api, user } = await openBoard()
    await user.type(screen.getByLabelText('Add todo to Friday Oct 16'), '   {Enter}')
    expect(await screen.findByText('Enter a title')).toBeInTheDocument()
    expect(api.requests.some((r) => r.method === 'POST')).toBe(false)
  })
})

describe('new and edit form', () => {
  it('creates a todo with priority, date and tags', async () => {
    const { user } = await openBoard()
    await user.click(screen.getByRole('button', { name: 'New todo' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Title'), 'Report')
    await user.type(within(dialog).getByLabelText('Due date'), '2026-10-16')
    await user.selectOptions(within(dialog).getByLabelText('Priority'), 'high')
    await user.click(within(dialog).getByLabelText('Work'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    const card = await within(column(/Friday/)).findByText('Report')
    expect(card).toBeInTheDocument()
    expect(within(column(/Friday/)).getByText('Work')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an inline error for an empty title', async () => {
    const { user } = await openBoard()
    await user.click(screen.getByRole('button', { name: 'New todo' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toBeInTheDocument()
  })

  it('edits a todo and can clear its due date', async () => {
    const { api, user } = await openBoard([{ title: 'Old', dueDate: '2026-10-15' }])
    await user.click(await screen.findByRole('button', { name: /^Edit/ }))
    const dialog = screen.getByRole('dialog')
    const title = within(dialog).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'New')
    await user.clear(within(dialog).getByLabelText('Due date'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(column('Unscheduled')).findByText('New')).toBeInTheDocument()
    const patch = api.requests.find((r) => r.method === 'PATCH')
    expect(patch?.body).toMatchObject({ title: 'New', dueDate: null })
  })

  it('closes with Escape', async () => {
    const { user } = await openBoard()
    await user.click(screen.getByRole('button', { name: 'New todo' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New todo' })).toHaveFocus()
  })
})

describe('completion', () => {
  it('checks a todo off and back on', async () => {
    const { user } = await openBoard([{ title: 'Task', dueDate: '2026-10-15' }])
    const box = await screen.findByRole('checkbox', { name: 'Complete "Task"' })
    await user.click(box)
    await waitFor(() => expect(box).toBeChecked())
    await user.click(box)
    await waitFor(() => expect(box).not.toBeChecked())
  })
})

describe('overdue', () => {
  it('reschedules to today', async () => {
    const { api, user } = await openBoard([{ title: 'Late', dueDate: '2026-10-10' }])
    const overdue = column('Overdue')
    expect(await within(overdue).findByText('Due Oct 10')).toBeInTheDocument()
    await user.click(within(overdue).getByRole('button', { name: /Reschedule to today/ }))
    expect(await within(column(/Thursday/)).findByText('Late')).toBeInTheDocument()
    expect(api.requests.find((r) => r.method === 'PATCH')?.body).toEqual({
      dueDate: '2026-10-15',
    })
  })

  it('does not count completed todos as overdue', async () => {
    await openBoard([{ title: 'Done late', dueDate: '2026-10-10', completed: true }])
    expect(within(column('Overdue')).getByText('Nothing overdue.')).toBeInTheDocument()
  })

  it('loads more when there are over 50', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      title: `Late ${i}`,
      dueDate: '2026-10-01',
    }))
    const { user } = await openBoard(many)
    const overdue = column('Overdue')
    await within(overdue).findByText('Late 0')
    expect(within(overdue).getAllByRole('listitem')).toHaveLength(50)
    await user.click(within(overdue).getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(within(overdue).getAllByRole('listitem')).toHaveLength(60))
    expect(within(overdue).queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })
})

describe('week navigation', () => {
  it('moves between weeks and back to this week', async () => {
    const { user } = await openBoard([
      { title: 'Current task', dueDate: '2026-10-15' },
      { title: 'Next week', dueDate: '2026-10-19' },
    ])
    expect(screen.getByText('Oct 12 – Oct 18, 2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(await screen.findByText('Oct 19 – Oct 25, 2026')).toBeInTheDocument()
    expect(await within(column(/Monday/)).findByText('Next week')).toBeInTheDocument()
    expect(screen.queryByText('Current task')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'This week' }))
    expect(await screen.findByText('Current task')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(await screen.findByText('Oct 5 – Oct 11, 2026')).toBeInTheDocument()
  })

  it('puts Sunday in the old week and Monday in the next', async () => {
    const { user } = await openBoard([
      { title: 'Sun', dueDate: '2026-10-18' },
      { title: 'Mon', dueDate: '2026-10-19' },
    ])
    expect(await within(column(/Sunday/)).findByText('Sun')).toBeInTheDocument()
    expect(screen.queryByText('Mon')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(await within(column(/Monday/)).findByText('Mon')).toBeInTheDocument()
  })
})

describe('tags', () => {
  it('creates, renames and deletes a tag, and shows server errors', async () => {
    const { user } = await openBoard([], [{ id: 'g1', name: 'Work' }])
    await user.click(screen.getByRole('button', { name: 'Manage tags' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('New tag'), 'work')
    await user.click(within(dialog).getByRole('button', { name: /add|create/i }))
    expect(await within(dialog).findByText(/already exists/i)).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('New tag'))
    await user.type(within(dialog).getByLabelText('New tag'), 'Gym')
    await user.click(within(dialog).getByRole('button', { name: /add|create/i }))
    expect(await within(dialog).findByLabelText('Rename Gym')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Delete Gym' }))
    await waitFor(() => expect(within(dialog).queryByLabelText('Rename Gym')).toBeNull())
  })
})

describe('filters', () => {
  const seed: Seed[] = [
    { title: 'Work high', dueDate: '2026-10-15', priority: 'high', tagIds: ['g1'] },
    { title: 'Home low', dueDate: '2026-10-15', priority: 'low', tagIds: ['g2'] },
    { title: 'Done work', dueDate: '2026-10-15', completed: true, tagIds: ['g1'] },
  ]

  it('filters by tag and priority together and can clear', async () => {
    const { user } = await openBoard(seed)
    await screen.findByText('Home low')
    await user.selectOptions(screen.getByLabelText('Tag'), 'g1')
    await waitFor(() => expect(screen.queryByText('Home low')).not.toBeInTheDocument())
    expect(screen.getByText('Work high')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Priority'), 'low')
    expect(await screen.findByText(/No todos match your filters/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(await screen.findByText('Home low')).toBeInTheDocument()
  })

  it('hides completed todos', async () => {
    const { user } = await openBoard(seed)
    await screen.findByText('Done work')
    await user.click(screen.getByLabelText('Hide completed'))
    await waitFor(() => expect(screen.queryByText('Done work')).not.toBeInTheDocument())
    expect(screen.getByText('Work high')).toBeInTheDocument()
  })

  it('keeps filters when changing week and removes one chip at a time', async () => {
    const { user } = await openBoard(seed)
    await screen.findByText('Home low')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.getByLabelText('Priority')).toHaveValue('high')
    await user.click(screen.getByRole('button', { name: 'Remove filter Priority: High' }))
    expect(screen.getByLabelText('Priority')).toHaveValue('')
  })
})
