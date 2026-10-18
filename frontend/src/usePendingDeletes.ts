import { useCallback, useEffect, useRef, useState } from 'react'
import { messageFor, useNotify } from './Notices'
import { useDeleteTodo, type Todo } from './todos'

export const UNDO_MS = 5000

type Pending = { id: string; title: string; sent: boolean }

// Delete hides the card at once and only calls the server after the Undo window closes.
// Leaving the page before then simply cancels the delete (accepted behavior, AC7.6).
export function usePendingDeletes() {
  const del = useDeleteTodo()
  const notify = useNotify()
  const [pending, setPending] = useState<Pending[]>([])
  const timers = useRef(new Map<string, number>())

  useEffect(() => {
    const active = timers.current
    return () => active.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const remove = (id: string) => setPending((list) => list.filter((p) => p.id !== id))

  const start = useCallback(
    (todo: Todo) => {
      setPending((list) => [...list, { id: todo.id, title: todo.title, sent: false }])
      const timer = window.setTimeout(() => {
        timers.current.delete(todo.id)
        setPending((list) => list.map((p) => (p.id === todo.id ? { ...p, sent: true } : p)))
        del.mutate(todo.id, {
          onError: (err) => notify(messageFor(err)),
          onSettled: () => remove(todo.id),
        })
      }, UNDO_MS)
      timers.current.set(todo.id, timer)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [del.mutate, notify],
  )

  const undo = useCallback((id: string) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    remove(id)
  }, [])

  return {
    hiddenIds: new Set(pending.map((p) => p.id)),
    toasts: pending.filter((p) => !p.sent),
    start,
    undo,
  }
}
