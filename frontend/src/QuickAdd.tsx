import { useId, useState, type FormEvent } from 'react'
import { ApiError } from './api'
import { messageFor } from './Notices'
import { useCreateTodo } from './todos'
import styles from './QuickAdd.module.css'

// Type a title, press Enter: the todo gets this column's date (or none), medium priority, no tags.
export default function QuickAdd({ label, dueDate }: { label: string; dueDate?: string }) {
  const create = useCreateTodo()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string>()
  const inputId = useId()
  const errorId = useId()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (title.trim() === '') {
      setError('Enter a title')
      return
    }
    setError(undefined)
    try {
      await create.mutateAsync({ title, dueDate })
      setTitle('')
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? (err.fields.title ?? err.message)
          : messageFor(err),
      )
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form}>
      <label htmlFor={inputId} className={styles.srOnly}>
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        placeholder="Add a todo…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  )
}
