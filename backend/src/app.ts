import express from 'express'
import { authRouter } from './authRoutes.js'
import { errorHandler, notFoundHandler } from './errors.js'
import { originCheck, requireAuth } from './middleware.js'
import { tagsRouter } from './tagsRoutes.js'
import { todosRouter } from './todosRoutes.js'

export function createApp() {
  const app = express()
  // One reverse proxy (nginx) sits in front, so trust its X-Forwarded-For for the client IP.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' })
  })

  const api = express.Router()
  api.use(originCheck)
  api.use('/auth', authRouter)
  api.use('/tags', requireAuth, tagsRouter)
  api.use('/todos', requireAuth, todosRouter)
  app.use('/api', api)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
