import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from './api'

export type User = { id: string; email: string }
type Credentials = { email: string; password: string }

// null means "not logged in"; the 401 from /auth/me is an expected answer, not an error.
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<User>('GET', '/auth/me')
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    staleTime: Infinity,
    retry: false,
  })
}

function useCredentialsMutation(path: '/auth/login' | '/auth/register') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: Credentials) => api<User>('POST', path, credentials),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  })
}

export const useLogin = () => useCredentialsMutation('/auth/login')
export const useRegister = () => useCredentialsMutation('/auth/register')

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await api('POST', '/auth/logout')
      } catch (err) {
        // An already-expired session (401) is effectively logged out.
        if (!(err instanceof ApiError && err.status === 401)) throw err
      }
    },
    onSuccess: () => {
      // Drop every cached list so the next person on this browser never sees my data.
      queryClient.setQueryData(['me'], null)
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
    },
  })
}
