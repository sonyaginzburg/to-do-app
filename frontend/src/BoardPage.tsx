import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useState } from 'react'
import Column from './Column'
import FilterBar from './FilterBar'
import { NoticeProvider, messageFor, useNotify } from './Notices'
import { UNSCHEDULED, type MoveOption } from './TodoCard'
import TagsModal from './TagsModal'
import TodoFormModal from './TodoFormModal'
import { useLogout, useMe } from './auth'
import { addDays, formatRange, shortDate, startOfWeek, today, weekDays, weekdayName } from './dates'
import {
  NO_FILTERS,
  WEEK_LIMIT,
  compareTodos,
  hasFilters,
  useColumnTodos,
  useUpdateTodo,
  useWeekTodos,
  type Todo,
} from './todos'
import { useNarrow } from './useNarrow'
import { usePendingDeletes } from './usePendingDeletes'
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

  const narrow = useNarrow()
  const notify = useNotify()
  const updateTodo = useUpdateTodo()
  const deletes = usePendingDeletes()
  const [tab, setTab] = useState<string | null>(null)
  // Cards the user just moved: shown in their new column right away, until the server confirms.
  const [moved, setMoved] = useState<Record<string, string | null>>({})
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const days = weekDays(weekStart)
  const goToWeek = (start: string) => {
    setWeekStart(start)
    setTab(null)
  }
  const weekItems = week.isPlaceholderData ? [] : (week.data?.items ?? [])
  const rawOverdue = overdue.data?.pages.flatMap((p) => p.items) ?? []
  const rawUnscheduled = unscheduled.data?.pages.flatMap((p) => p.items) ?? []

  const visible = (todo: Todo): Todo | null => {
    if (deletes.hiddenIds.has(todo.id)) return null
    return todo.id in moved ? { ...todo, dueDate: moved[todo.id] } : todo
  }
  const everything = new Map<string, Todo>()
  for (const raw of [...rawOverdue, ...weekItems, ...rawUnscheduled]) {
    const todo = visible(raw)
    if (todo) everything.set(todo.id, todo)
  }
  const all = [...everything.values()]

  // Unfinished todos from earlier days live in Overdue, not in their old day column.
  const isOverdue = (t: Todo) => !t.completed && t.dueDate !== null && t.dueDate < todayISO
  const overdueItems = rawOverdue
    .map(visible)
    .filter((t): t is Todo => t !== null && t.dueDate !== null && isOverdue(t))
  const byDay = new Map<string, Todo[]>()
  for (const day of days) {
    byDay.set(day, all.filter((t) => t.dueDate === day && !isOverdue(t)).sort(compareTodos))
  }
  const unscheduledItems = all.filter((t) => t.dueDate === null).sort(compareTodos)

  const moveOptions: MoveOption[] = [
    ...days.map((d) => ({ value: d, label: `${weekdayName(d)} ${shortDate(d)}` })),
    { value: UNSCHEDULED, label: 'Unscheduled' },
  ]

  async function move(todo: Todo, value: string) {
    const dueDate = value === UNSCHEDULED ? null : value
    if (todo.dueDate === dueDate) return
    setMoved((m) => ({ ...m, [todo.id]: dueDate }))
    try {
      await updateTodo.mutateAsync({ id: todo.id, dueDate })
    } catch (err) {
      notify(messageFor(err))
    } finally {
      setMoved((m) => Object.fromEntries(Object.entries(m).filter(([id]) => id !== todo.id)))
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const todo = all.find((t) => t.id === active.id)
    const target = over?.id.toString()
    if (!todo || !target || target === 'overdue') return
    void move(todo, target === 'unscheduled' ? UNSCHEDULED : target.replace('day:', ''))
  }

  const totalTodos =
    (week.data?.total ?? 0) +
    (overdue.data?.pages[0]?.total ?? 0) +
    (unscheduled.data?.pages[0]?.total ?? 0)
  const nothingToShow = loaded && totalTodos === 0
  const noMatches = nothingToShow && hasFilters(filters)
  const firstTime = nothingToShow && !hasFilters(filters)

  const tabs = [
    { key: 'overdue', label: 'Overdue' },
    ...days.map((d) => ({ key: d, label: weekdayName(d).slice(0, 3) })),
    { key: 'unscheduled', label: 'Unscheduled' },
  ]
  const activeTab = tab ?? (days.includes(todayISO) ? todayISO : days[0])
  const show = (key: string) => !narrow || key === activeTab
  const shared = {
    draggable: !narrow,
    moveOptions,
    onMove: move,
    onEdit: setEditing,
    onDelete: deletes.start,
  }

  const moreButton = (query: typeof overdue) =>
    query.hasNextPage && (
      <button
        type="button"
        className={styles.more}
        onClick={() => query.fetchNextPage()}
        disabled={query.isFetchingNextPage}
      >
        {query.isFetchingNextPage ? 'Loadingâ€¦' : 'Load more'}
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
            <button type="button" onClick={() => goToWeek(addDays(weekStart, -7))}>
              Previous week
            </button>
            <button type="button" onClick={() => goToWeek(startOfWeek(todayISO))}>
              This week
            </button>
            <button type="button" onClick={() => goToWeek(addDays(weekStart, 7))}>
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

      <DndContext sensors={sensors} onDragEnd={narrow ? undefined : onDragEnd}>
        {narrow && (
          <div role="tablist" aria-label="Columns" className={styles.tabs}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={t.key === activeTab}
                className={t.key === activeTab ? styles.activeTab : undefined}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className={narrow ? styles.single : styles.board}>
          {show('overdue') && (
            <Column
              {...shared}
              title="Overdue"
              dropId="overdue"
              todos={overdueItems}
              emptyText="Nothing overdue."
              overdue
              loading={overdue.isPending}
              footer={moreButton(overdue)}
            />
          )}
          {days.map(
            (day) =>
              show(day) && (
                <Column
                  {...shared}
                  key={day}
                  title={weekdayName(day)}
                  subtitle={shortDate(day)}
                  dropId={`day:${day}`}
                  todos={byDay.get(day) ?? []}
                  emptyText="No todos. Add one below."
                  isToday={day === todayISO}
                  loading={weekLoading}
                  quickAdd={{
                    label: `Add todo to ${weekdayName(day)} ${shortDate(day)}`,
                    dueDate: day,
                  }}
                />
              ),
          )}
          {show('unscheduled') && (
            <Column
              {...shared}
              title="Unscheduled"
              dropId="unscheduled"
              todos={unscheduledItems}
              emptyText="No todos. Add one below."
              loading={unscheduled.isPending}
              quickAdd={{ label: 'Add todo to Unscheduled' }}
              footer={moreButton(unscheduled)}
            />
          )}
        </div>
      </DndContext>

      {deletes.toasts.length > 0 && (
        <div role="status" className={styles.toasts}>
          {deletes.toasts.map((t) => (
            <div key={t.id} className={styles.toast}>
              <span>Deleted â€œ{t.title}â€</span>
              <button type="button" onClick={() => deletes.undo(t.id)}>
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

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
