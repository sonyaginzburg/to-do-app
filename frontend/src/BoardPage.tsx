import { useState } from 'react'
import Column from './Column'
import FilterBar from './FilterBar'
import { NoticeProvider } from './Notices'
import TagsModal from './TagsModal'
import TodoFormModal from './TodoFormModal'
import { useLogout, useMe } from './auth'
import { addDays, formatRange, shortDate, startOfWeek, today, weekDays, weekdayName } from './dates'
import {
  NO_FILTERS,
  WEEK_LIMIT,
  hasFilters,
  useColumnTodos,
  useWeekTodos,
  type Todo,
} from './todos'
import styles from './BoardPage.module.css'

export default function BoardPage() {
  return (
    <NoticeProvider>
      <Board />
    </NoticeProvider>
  )
}

function Board() {
  const { data: user } = useMe()
  const logout = useLogout()
  const todayISO = today()

  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO))
  const [filters, setFilters] = useState(NO_FILTERS)
  const [editing, setEditing] = useState<Todo | 'new' | null>(null)
  const [managingTags, setManagingTags] = useState(false)

  const week = useWeekTodos(weekStart, filters)
  const overdue = useColumnTodos('overdue', todayISO, filters)
  const unscheduled = useColumnTodos('unscheduled', todayISO, filters)

  const weekLoading = week.isPending || week.isPlaceholderData
  const loaded = !weekLoading && overdue.isSuccess && unscheduled.isSuccess
  const failed = week.isError || overdue.isError || unscheduled.isError

  const weekItems = week.isPlaceholderData ? [] : (week.data?.items ?? [])
  const byDay = new Map<string, Todo[]>()
  for (const todo of weekItems) {
    const day = todo.dueDate!
    byDay.set(day, [...(byDay.get(day) ?? []), todo])
  }
  const overdueItems = overdue.data?.pages.flatMap((p) => p.items) ?? []
  const unscheduledItems = unscheduled.data?.pages.flatMap((p) => p.items) ?? []

  const totalTodos =
    (week.data?.total ?? 0) +
    (overdue.data?.pages[0]?.total ?? 0) +
    (unscheduled.data?.pages[0]?.total ?? 0)
  const nothingToShow = loaded && totalTodos === 0
  const noMatches = nothingToShow && hasFilters(filters)
  const firstTime = nothingToShow && !hasFilters(filters)

  const moreButton = (query: typeof overdue) =>
    query.hasNextPage && (
      <button
        type="button"
        className={styles.more}
        onClick={() => query.fetchNextPage()}
        disabled={query.isFetchingNextPage}
      >
        {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
      </button>
    )

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>To-do planner</h1>
          <div className={styles.account}>
            <span>{user?.email}</span>
            <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
              Log out
            </button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.weekNav} role="group" aria-label="Week navigation">
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              Previous week
            </button>
            <button type="button" onClick={() => setWeekStart(startOfWeek(todayISO))}>
              This week
            </button>
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Next week
            </button>
            <span className={styles.range} aria-live="polite">
              {formatRange(weekStart)}
            </span>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={() => setManagingTags(true)}>
              Manage tags
            </button>
            <button type="button" className={styles.primary} onClick={() => setEditing('new')}>
              New todo
            </button>
          </div>
        </div>

        <FilterBar filters={filters} onChange={setFilters} showClear={!noMatches} />
        {logout.isError && <p role="alert">Could not log out. Please try again.</p>}
      </header>

      {failed && (
        <div role="alert" className={styles.banner}>
          Could not load your todos.{' '}
          <button
            type="button"
            onClick={() => {
              void week.refetch()
              void overdue.refetch()
              void unscheduled.refetch()
            }}
          >
            Try again
          </button>
        </div>
      )}
      {noMatches && (
        <div role="status" className={styles.banner}>
          No todos match your filters.{' '}
          <button type="button" onClick={() => setFilters(NO_FILTERS)}>
            Clear filters
          </button>
        </div>
      )}
      {firstTime && (
        <p role="status" className={styles.hint}>
          Add your first todo to any day.
        </p>
      )}

      <div className={styles.board}>
        <Column
          title="Overdue"
          todos={overdueItems}
          emptyText="Nothing overdue."
          overdue
          loading={overdue.isPending}
          footer={moreButton(overdue)}
          onEdit={setEditing}
        />
        {weekDays(weekStart).map((day) => (
          <Column
            key={day}
            title={weekdayName(day)}
            subtitle={shortDate(day)}
            todos={byDay.get(day) ?? []}
            emptyText="No todos. Add one below."
            isToday={day === todayISO}
            loading={weekLoading}
            quickAdd={{ label: `Add todo to ${weekdayName(day)} ${shortDate(day)}`, dueDate: day }}
            onEdit={setEditing}
          />
        ))}
        <Column
          title="Unscheduled"
          todos={unscheduledItems}
          emptyText="No todos. Add one below."
          loading={unscheduled.isPending}
          quickAdd={{ label: 'Add todo to Unscheduled' }}
          footer={moreButton(unscheduled)}
          onEdit={setEditing}
        />
      </div>

      {week.data && week.data.total > WEEK_LIMIT && !week.isPlaceholderData && (
        <p className={styles.hint}>Showing first {WEEK_LIMIT} todos of this week.</p>
      )}

      {editing && (
        <TodoFormModal
          todo={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {managingTags && <TagsModal onClose={() => setManagingTags(false)} />}
    </main>
  )
}
