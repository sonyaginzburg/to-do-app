import { useState, type FormEvent } from 'react'
import Modal from './Modal'
import { messageFor } from './Notices'
import { useTagMutations, useTags, type Tag } from './todos'
import { ApiError } from './api'
import styles from './forms.module.css'
import tagStyles from './TagsModal.module.css'

const tagError = (err: unknown) =>
  err instanceof ApiError && err.status === 400
    ? (Object.values(err.fields)[0] ?? 'Invalid tag name')
    : messageFor(err)

function TagRow({ tag }: { tag: Tag }) {
  const { rename, remove } = useTagMutations()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tag.name)
  const [error, setError] = useState<string>()

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    try {
      await rename.mutateAsync({ id: tag.id, name })
      setEditing(false)
    } catch (err) {
      setError(tagError(err))
    }
  }

  async function del() {
    setError(undefined)
    try {
      await remove.mutateAsync(tag.id)
    } catch (err) {
      setError(tagError(err))
    }
  }

  return (
    <li className={tagStyles.row}>
      {editing ? (
        <form onSubmit={save} className={tagStyles.inline}>
          <label htmlFor={`rename-${tag.id}`} className={tagStyles.srOnly}>
            New name for {tag.name}
          </label>
          <input
            id={`rename-${tag.id}`}
            type="text"
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className={styles.primary} disabled={rename.isPending}>
            Save
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setEditing(false)
              setName(tag.name)
              setError(undefined)
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <span className={tagStyles.name}>{tag.name}</span>
          <button
            type="button"
            className={styles.secondary}
            aria-label={`Rename ${tag.name}`}
            onClick={() => setEditing(true)}
          >
            Rename
          </button>
          <button
            type="button"
            className={styles.danger}
            aria-label={`Delete ${tag.name}`}
            onClick={del}
            disabled={remove.isPending}
          >
            Delete
          </button>
        </>
      )}
      {error && (
        <p role="alert" className={`${styles.error} ${tagStyles.rowError}`}>
          {error}
        </p>
      )}
    </li>
  )
}

export default function TagsModal({ onClose }: { onClose: () => void }) {
  const tags = useTags()
  const { create } = useTagMutations()
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()

  async function add(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    try {
      await create.mutateAsync(name)
      setName('')
    } catch (err) {
      setError(tagError(err))
    }
  }

  return (
    <Modal title="Manage tags" onClose={onClose}>
      <form onSubmit={add} noValidate className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="new-tag">New tag</label>
          <div className={tagStyles.inline}>
            <input
              id="new-tag"
              type="text"
              data-autofocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'new-tag-error' : undefined}
            />
            <button type="submit" className={styles.primary} disabled={create.isPending}>
              Add tag
            </button>
          </div>
          {error && (
            <p id="new-tag-error" role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
      </form>

      <h3 className={tagStyles.listHeading}>Your tags</h3>
      <p className={styles.hint}>Deleting a tag removes it from your todos. The todos stay.</p>
      {tags.isError && (
        <p role="alert" className={styles.error}>
          Could not load your tags.
        </p>
      )}
      {tags.data?.length === 0 && <p className={styles.hint}>No tags yet.</p>}
      <ul className={tagStyles.list}>
        {tags.data?.map((tag) => (
          <TagRow key={tag.id} tag={tag} />
        ))}
      </ul>
    </Modal>
  )
}
