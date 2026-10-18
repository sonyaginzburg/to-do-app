import { useDraggable } from '@dnd-kit/core'
import { messageFor, useNotify } from './Notices'
import { shortDate, today } from './dates'
import { useUpdateTodo, type Todo } from './todos'
import styles from './TodoCard.module.css'

const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const

// value is a date like 2026-10-16, or UNSCHEDULED
export const UNSCHEDULED = 'none'
export type MoveOption = { value: string; label: string }

export default function TodoCard({
  todo,
  overdue = false,
  draggable = false,
  moveOptions,
  onMove,
  onEdit,
  onDelete,
}: {
  todo: Todo
  overdue?: boolean
  draggable?: boolean
  moveOptions: MoveOption[]
  onMove: (todo: Todo, value: string) => void
  onEdit: (todo: Todo) => void
  onDelete: (todo: Todo) => void
}) {
  const update = useUpdateTodo()
  const notify = useNotify()
  const { setNodeRef, listeners, transform, isDragging } = useDraggable({
    id: todo.id,
    disabled: !draggable,
  })

  const change = (changes: { completed: boolean } | { dueDate: string }) =>
    update.mutate({ id: todo.id, ...changes }, { onError: (err) => notify(messageFor(err)) })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...(draggable ? listeners : {})}
      className={`${styles.card} ${todo.completed ? styles.done : ''} ${
        draggable ? styles.draggable : ''
      } ${isDragging ? styles.dragging : ''}`}
      data-priority={todo.priority}
    >
      <div className={styles.top}>
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={(e) => change({ completed: e.target.checked })}
          aria-label={`Complete "${todo.title}"`}
        />
        <span className={styles.title}>{todo.title}</span>
      </div>

      <div className={styles.meta}>
        <span className={styles.priority}>{PRIORITY_LABEL[todo.priority]}</span>
        {overdue && todo.dueDate && <span>Due {shortDate(todo.dueDate)}</span>}
        {todo.tags.map((tag) => (
          <span key={tag.id} className={styles.tag}>
            {tag.name}
          </span>
        ))}
      </div>

      <div className={styles.actions}>
        {overdue && (
          <button
            type="button"
            aria-label={`Reschedule to today: ${todo.title}`}
            onClick={() => change({ dueDate: today() })}
          >
            Reschedule to today
          </button>
        )}
        <button type="button" aria-label={`Edit: ${todo.title}`} onClick={() => onEdit(todo)}>
          Edit
        </button>
        <select
          aria-label={`Move to: ${todo.title}`}
          value=""
          onChange={(e) => onMove(todo, e.target.value)}
        >
          <option value="" disabled>
            Move to…
          </option>
          {moveOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.delete}
          aria-label={`Delete: ${todo.title}`}
          onClick={() => onDelete(todo)}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
