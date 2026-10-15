import { Router } from 'express'
import { z } from 'zod'
import { prisma } from './db.js'
import { conflict, notFound } from './errors.js'
import { parseBody, requireUuid } from './validation.js'

const tagBodySchema = z.object({
  name: z
    .string({ error: 'Required' })
    .trim()
    .min(1, 'Name is required')
    .max(30, 'Name must be at most 30 characters'),
})

const isUniqueViolation = (err: unknown) =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'

const toDto = (tag: { id: string; name: string }) => ({ id: tag.id, name: tag.name })

export const tagsRouter = Router()

tagsRouter.get('/', async (_req, res) => {
  const tags = await prisma.tag.findMany({ where: { userId: res.locals.userId } })
  tags.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  res.status(200).json(tags.map(toDto))
})

tagsRouter.post('/', async (req, res) => {
  const { name } = parseBody(tagBodySchema, req.body)
  try {
    const tag = await prisma.tag.create({ data: { userId: res.locals.userId, name } })
    res.status(201).json(toDto(tag))
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('Tag already exists')
    throw err
  }
})

tagsRouter.patch('/:id', async (req, res) => {
  const id = requireUuid(req.params.id)
  const { name } = parseBody(tagBodySchema, req.body)

  // The user_id in the where clause is the ownership check: other users' tags are "not found".
  const owned = await prisma.tag.findFirst({ where: { id, userId: res.locals.userId } })
  if (!owned) throw notFound()

  try {
    const tag = await prisma.tag.update({ where: { id }, data: { name } })
    res.status(200).json(toDto(tag))
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('Tag already exists')
    throw err
  }
})

tagsRouter.delete('/:id', async (req, res) => {
  const id = requireUuid(req.params.id)
  const { count } = await prisma.tag.deleteMany({ where: { id, userId: res.locals.userId } })
  if (count === 0) throw notFound()
  res.status(204).end()
})
