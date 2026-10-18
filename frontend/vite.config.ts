import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the browser talks to Vite (port 5173) and Vite forwards /api to the backend,
// so the app and API share one origin, just like nginx does in production.
// Set ALLOWED_ORIGIN=http://localhost:5173 in the backend .env while using this dev server.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
