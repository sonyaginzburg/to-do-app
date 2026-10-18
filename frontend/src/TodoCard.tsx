import { messageFor, useNotify } from './Notices'
import { shortDate, today } from './dates'
import { useUpdateTodo, type Todo } from './todos'
import styles from './TodoCard.module.css'

const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const

export default function TodoCard({
  todo,
  overdue = false,
  onEdit,
}: {
  todo: Todo
  overdue?: boolean
  onEdit: (todo: Todo) => void
}) {
  const update = useUpdateTodo()
  const notify = useNotify()

  const change = (changes: { completed: boolean } | { dueDate: string }) =>
    update.mutate({ id: todo.id, ...changes }, { onError: (err) => notify(messageFor(err)) })

  return (
    <li
      className={`${styles.card} ${todo.completed ? styles.done : ''}`}
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
      </div>
    </li>
  )
}
