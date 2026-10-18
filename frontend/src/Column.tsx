import type { ReactNode } from 'react'
import QuickAdd from './QuickAdd'
import TodoCard from './TodoCard'
import type { Todo } from './todos'
import styles from './Column.module.css'

type Props = {
  title: string
  subtitle?: string
  todos: Todo[]
  emptyText: string
  isToday?: boolean
  overdue?: boolean
  // Omit for Overdue, which has no quick-add. dueDate is undefined for Unscheduled.
  quickAdd?: { label: string; dueDate?: string }
  footer?: ReactNode
  loading?: boolean
  onEdit: (todo: Todo) => void
}

export default function Column({
  title,
  subtitle,
  todos,
  emptyText,
  isToday = false,
  overdue = false,
  quickAdd,
  footer,
  loading = false,
  onEdit,
}: Props) {
  return (
    <section
      className={`${styles.column} ${isToday ? styles.today : ''}`}
      aria-label={subtitle ? `${title} ${subtitle}` : title}
      aria-current={isToday ? 'date' : undefined}
    >
      <header className={styles.header}>
        <h2>{title}</h2>
        {subtitle && <span className={styles.date}>{subtitle}</span>}
        {isToday && <span className={styles.badge}>Today</span>}
      </header>

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : todos.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <ul className={styles.list}>
          {todos.map((todo) => (
            <TodoCard key={todo.id} todo={todo} overdue={overdue} onEdit={onEdit} />
          ))}
        </ul>
      )}

      {footer}
      {quickAdd && <QuickAdd label={quickAdd.label} dueDate={quickAdd.dueDate} />}
    </section>
  )
}
