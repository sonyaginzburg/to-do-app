import { useLogout, useMe } from './auth'
import styles from './HomePage.module.css'

// Placeholder: the weekly board replaces this in the next phase.
export default function HomePage() {
  const { data: user } = useMe()
  const logout = useLogout()

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>To-do planner</h1>
        <div className={styles.account}>
          <span>{user?.email}</span>
          <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Log out
          </button>
        </div>
      </header>
      {logout.isError && <p role="alert">Could not log out. Please try again.</p>}
      <p>Your weekly board is coming soon.</p>
    </main>
  )
}
