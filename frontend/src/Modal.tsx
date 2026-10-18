import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Modal.module.css'

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'

// Closes with Esc, keeps Tab inside, and hands focus back to whatever opened it.
export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const target =
      dialog.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog.current?.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus()
    return () => opener?.focus()
  }, [])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
        onKeyDown={onKeyDown}
      >
        <div className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={styles.close}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
