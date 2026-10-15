import { Navigate, Outlet } from 'react-router-dom'
import { useMe } from './auth'

function Loading() {
  return (
    <p role="status" style={{ padding: 'var(--space-4)' }}>
      Loading…
    </p>
  )
}

function CouldNotCheck() {
  return (
    <p role="alert" style={{ padding: 'var(--space-4)' }}>
      Cannot reach the server. Please refresh the page.
    </p>
  )
}

// Logged-out visitors are sent to /login.
export function RequireAuth() {
  const { data, isPending, isError } = useMe()
  if (isPending) return <Loading />
  if (isError) return <CouldNotCheck />
  return data ? <Outlet /> : <Navigate to="/login" replace />
}

// Logged-in users have no reason to see /login or /register, so they go to the board.
export function RedirectIfAuthed() {
  const { data, isPending, isError } = useMe()
  if (isPending) return <Loading />
  if (isError) return <CouldNotCheck />
  return data ? <Navigate to="/" replace /> : <Outlet />
}
