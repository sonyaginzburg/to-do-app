import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from './api'
import { addDays } from './dates'

export type Priority = 'low' | 'medium' | 'high'
export type Tag = { id: string; name: string }
export type Todo = {
  id: string
  title: string
  completed: boolean
  priority: Priority
  dueDate: string | null
  tags: Tag[]
  createdAt: string
  updatedAt: string
}
type TodoPage = { items: Todo[]; total: number; limit: number; offset: number }

export type Filters = { tagId?: string; priority?: Priority; hideCompleted: boolean }
export const NO_FILTERS: Filters = { hideCompleted: false }
export const hasFilters = (f: Filters) => Boolean(f.tagId || f.priority || f.hideCompleted)

export const WEEK_LIMIT = 200
const COLUMN_PAGE = 50

type Scope = Record<string, string>

function listUrl(scope: Scope, filters: Filters, paging: { limit: number; offset?: number }) {
  const params = new URLSearchParams(scope)
  if (filters.tagId) params.set('tagId', filters.tagId)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.hideCompleted) params.set('completed', 'false')
  params.set('limit', String(paging.limit))
  if (paging.offset) params.set('offset', String(paging.offset))
  return `/todos?${params}`
}

export function useWeekTodos(weekStart: string, filters: Filters) {
  return useQuery({
    queryKey: ['todos', 'week', weekStart, filters],
    queryFn: () =>
      api<TodoPage>(
        'GET',
        listUrl({ dueFrom: weekStart, dueTo: addDays(weekStart, 6) }, filters, {
          limit: WEEK_LIMIT,
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

// Overdue and Unscheduled can be long, so they load 50 at a time with a "Load more" button.
export function useColumnTodos(kind: 'overdue' | 'unscheduled', today: string, filters: Filters) {
  const scope: Scope = kind === 'overdue' ? { overdueBefore: today } : { unscheduled: 'true' }
  return useInfiniteQuery({
    queryKey: ['todos', kind, kind === 'overdue' ? today : null, filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<TodoPage>('GET', listUrl(scope, filters, { limit: COLUMN_PAGE, offset: pageParam })),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })
}

export function useTags() {
  return useQuery({ queryKey: ['tags'], queryFn: () => api<Tag[]>('GET', '/tags') })
}

type TodoInput = {
  title?: string
  completed?: boolean
  dueDate?: string | null
  priority?: Priority
  tagIds?: string[]
}

export function useCreateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TodoInput) => api<Todo>('POST', '/todos', input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })
}

export function useUpdateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...changes }: TodoInput & { id: string }) =>
      api<Todo>('PATCH', `/todos/${id}`, changes),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })
}

export function useDeleteTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api('DELETE', `/todos/${id}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })
}

// Same ordering the server uses, so a card that was moved by hand lands in the right spot.
export function compareTodos(a: Todo, b: Todo) {
  const rank = { high: 0, medium: 1, low: 2 }
  return (
    Number(a.completed) - Number(b.completed) ||
    rank[a.priority] - rank[b.priority] ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  )
}

export function useTagMutations() {
  const queryClient = useQueryClient()
  // A renamed or deleted tag also changes the todos that show it.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tags'] }),
      queryClient.invalidateQueries({ queryKey: ['todos'] }),
    ])
  return {
    create: useMutation({
      mutationFn: (name: string) => api<Tag>('POST', '/tags', { name }),
      onSettled: refresh,
    }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) =>
        api<Tag>('PATCH', `/tags/${id}`, { name }),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api('DELETE', `/tags/${id}`),
      onSettled: refresh,
    }),
  }
}
