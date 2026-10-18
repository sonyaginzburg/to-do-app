import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import QuickAdd from './QuickAdd'
import TodoCard, { type MoveOption } from './TodoCard'
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
  // Id other code uses to know where a card was dropped
  dropId: string
  draggable?: boolean
  moveOptions: MoveOption[]
  onMove: (todo: Todo, value: string) => void
  onEdit: (todo: Todo) => void
  onDelete: (todo: Todo) => void
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
  dropId,
  draggable = false,
  moveOptions,
  onMove,
  onEdit,
  onDelete,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId, disabled: !draggable })

  return (
    <section
      ref={setNodeRef}
      className={`${styles.column} ${isToday ? styles.today : ''} ${isOver ? styles.over : ''}`}
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
            <TodoCard
              key={todo.id}
              todo={todo}
              overdue={overdue}
              draggable={draggable}
              moveOptions={moveOptions}
              onMove={onMove}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      {footer}
      {quickAdd && <QuickAdd label={quickAdd.label} dueDate={quickAdd.dueDate} />}
    </section>
  )
}
