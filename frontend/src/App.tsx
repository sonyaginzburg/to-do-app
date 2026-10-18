import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AuthPage from './AuthPage'
import BoardPage from './BoardPage'
import { RedirectIfAuthed, RequireAuth } from './guards'

export default function App() {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<BoardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  )
}
