import { useState, type FormEvent } from 'react'
import { ApiError, type FieldErrors } from './api'
import Modal from './Modal'
import { messageFor } from './Notices'
import { useCreateTodo, useTags, useUpdateTodo, type Priority, type Todo } from './todos'
import styles from './forms.module.css'

// One form for both "New todo" and "Edit todo": pass a todo to edit it.
export default function TodoFormModal({ todo, onClose }: { todo?: Todo; onClose: () => void }) {
  const tags = useTags()
  const create = useCreateTodo()
  const update = useUpdateTodo()

  const [title, setTitle] = useState(todo?.title ?? '')
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? '')
  const [priority, setPriority] = useState<Priority>(todo?.priority ?? 'medium')
  const [tagIds, setTagIds] = useState<string[]>(todo?.tags.map((t) => t.id) ?? [])
  const [fields, setFields] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const saving = create.isPending || update.isPending

  const toggleTag = (id: string) =>
    setTagIds((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    )

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFields({})
    setFormError(undefined)
    try {
      if (todo) {
        await update.mutateAsync({ id: todo.id, title, dueDate: dueDate || null, priority, tagIds })
      } else {
        await create.mutateAsync({ title, dueDate: dueDate || undefined, priority, tagIds })
      }
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setFields(err.fields)
      else setFormError(messageFor(err))
    }
  }

  return (
    <Modal title={todo ? 'Edit todo' : 'New todo'} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className={styles.form}>
        {formError && (
          <p role="alert" className={styles.formError}>
            {formError}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="todo-title">Title</label>
          <input
            id="todo-title"
            type="text"
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={fields.title ? true : undefined}
            aria-describedby={fields.title ? 'todo-title-error' : undefined}
          />
          {fields.title && (
            <p id="todo-title-error" role="alert" className={styles.error}>
              {fields.title}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="todo-due">Due date</label>
          <input
            id="todo-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-invalid={fields.dueDate ? true : undefined}
          />
          {fields.dueDate ? (
            <p role="alert" className={styles.error}>
              {fields.dueDate}
            </p>
          ) : (
            <p className={styles.hint}>Leave empty to keep it in Unscheduled.</p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="todo-priority">Priority</label>
          <select
            id="todo-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <fieldset className={styles.field}>
          <legend>Tags</legend>
          {tags.data && tags.data.length > 0 ? (
            <div className={styles.checks}>
              {tags.data.map((tag) => (
                <label key={tag.id}>
                  <input
                    type="checkbox"
                    checked={tagIds.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          ) : (
            <p className={styles.hint}>
              {tags.isError
                ? 'Could not load your tags.'
                : 'No tags yet. Use "Manage tags" to add some.'}
            </p>
          )}
          {fields.tagIds && (
            <p role="alert" className={styles.error}>
              {fields.tagIds}
            </p>
          )}
        </fieldset>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
