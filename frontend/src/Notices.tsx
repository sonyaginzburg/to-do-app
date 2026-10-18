import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { ApiError } from './api'
import styles from './Notices.module.css'

type Notify = (message: string) => void
const NoticeContext = createContext<Notify>(() => {})

export const useNotify = () => useContext(NoticeContext)

export const messageFor = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'

// Shows one dismissible error banner for failures that have no form to show them in
// (for example, ticking a checkbox when the server is down).
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const notify = useCallback((text: string) => setMessage(text), [])

  return (
    <NoticeContext.Provider value={notify}>
      {children}
      {message && (
        <div role="alert" className={styles.notice}>
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      )}
    </NoticeContext.Provider>
  )
}
