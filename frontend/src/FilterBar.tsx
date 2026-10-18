import { hasFilters, useTags, type Filters, type Priority, NO_FILTERS } from './todos'
import styles from './FilterBar.module.css'

const PRIORITY_NAME: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

export default function FilterBar({
  filters,
  onChange,
  showClear = true,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  showClear?: boolean
}) {
  const tags = useTags()
  const tagName = tags.data?.find((t) => t.id === filters.tagId)?.name ?? 'Unknown tag'

  return (
    <div className={styles.bar}>
      <div className={styles.controls}>
        <label>
          Tag{' '}
          <select
            value={filters.tagId ?? ''}
            onChange={(e) => onChange({ ...filters, tagId: e.target.value || undefined })}
          >
            <option value="">All tags</option>
            {tags.data?.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority{' '}
          <select
            value={filters.priority ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                priority: (e.target.value || undefined) as Priority | undefined,
              })
            }
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={filters.hideCompleted}
            onChange={(e) => onChange({ ...filters, hideCompleted: e.target.checked })}
          />
          Hide completed
        </label>
      </div>

      {hasFilters(filters) && (
        <ul className={styles.chips} aria-label="Active filters">
          {filters.tagId && (
            <Chip
              text={`Tag: ${tagName}`}
              onRemove={() => onChange({ ...filters, tagId: undefined })}
            />
          )}
          {filters.priority && (
            <Chip
              text={`Priority: ${PRIORITY_NAME[filters.priority]}`}
              onRemove={() => onChange({ ...filters, priority: undefined })}
            />
          )}
          {filters.hideCompleted && (
            <Chip
              text="Hide completed"
              onRemove={() => onChange({ ...filters, hideCompleted: false })}
            />
          )}
          {showClear && (
            <li>
              <button type="button" className={styles.clear} onClick={() => onChange(NO_FILTERS)}>
                Clear filters
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function Chip({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <li className={styles.chip}>
      {text}
      <button type="button" onClick={onRemove} aria-label={`Remove filter ${text}`}>
        ×
      </button>
    </li>
  )
}
