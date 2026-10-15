import { Router } from 'express'
import { z } from 'zod'
import { prisma } from './db.js'
import { notFound, validationError } from './errors.js'
import type { Prisma } from './generated/prisma/client.js'
import { parseBody, requireUuid } from './validation.js'

const DAY_MS = 86_400_000

const dateString = (message = 'Use the format YYYY-MM-DD') =>
  z
    .string({ error: message })
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`)
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
    }, message)

// Due dates are calendar days with no time zone, so they are handled as UTC midnight.
const toDate = (s: string) => new Date(`${s}T00:00:00Z`)
const priority = z.enum(['low', 'medium', 'high'], { error: 'Must be low, medium or high' })
const title = z
  .string({ error: 'Required' })
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be at most 200 characters')
const tagIds = z
  .array(z.uuid({ error: 'Invalid tag id' }), { error: 'Must be a list of tag ids' })
  .transform((ids) => [...new Set(ids)])
  .refine((ids) => ids.length <= 10, 'A todo can have at most 10 tags')

const createSchema = z.object({
  title,
  dueDate: dateString().nullish(),
  priority: priority.optional(),
  tagIds: tagIds.optional(),
})

const updateSchema = z
  .object({
    title: title.optional(),
    completed: z.boolean({ error: 'Must be true or false' }).optional(),
    dueDate: dateString().nullable().optional(),
    priority: priority.optional(),
    tagIds: tagIds.optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
    path: ['body'],
  })

const boolString = (name: string) =>
  z
    .enum(['true', 'false'], { error: `${name} must be true or false` })
    .transform((v) => v === 'true')

const listSchema = z.object({
  dueFrom: dateString().optional(),
  dueTo: dateString().optional(),
  unscheduled: boolString('unscheduled').optional(),
  overdueBefore: dateString().optional(),
  completed: boolString('completed').optional(),
  priority: priority.optional(),
  tagId: z.uuid({ error: 'Invalid tag id' }).optional(),
  limit: z.coerce
    .number({ error: 'Must be a number' })
    .int('Must be a whole number')
    .min(1, 'Must be at least 1')
    .max(200, 'Must be at most 200')
    .default(50),
  offset: z.coerce
    .number({ error: 'Must be a number' })
    .int('Must be a whole number')
    .min(0, 'Must be 0 or more')
    .default(0),
})

const include = { tags: { include: { tag: true } } } satisfies Prisma.TodoInclude
type TodoWithTags = Prisma.TodoGetPayload<{ include: typeof include }>

const toDto = (t: TodoWithTags) => ({
  id: t.id,
  title: t.title,
  completed: t.completed,
  priority: t.priority,
  dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
  tags: t.tags
    .map(({ tag }) => ({ id: tag.id, name: tag.name }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
})

// Every tag id must belong to this user; one that doesn't is a 404 (existence is not revealed).
async function assertOwnedTags(userId: string, ids: string[]) {
  if (ids.length === 0) return
  const count = await prisma.tag.count({ where: { userId, id: { in: ids } } })
  if (count !== ids.length) throw notFound()
}

export const todosRouter = Router()

todosRouter.get('/', async (req, res) => {
  const userId: string = res.locals.userId
  const q = parseBody(listSchema, req.query)

  const hasRange = q.dueFrom !== undefined || q.dueTo !== undefined
  const scopes = [hasRange, q.unscheduled !== undefined, q.overdueBefore !== undefined].filter(
    Boolean,
  ).length
  if (scopes !== 1 || q.unscheduled === false) {
    throw validationError({
      scope: 'Provide exactly one of dueFrom+dueTo, unscheduled=true or overdueBefore',
    })
  }
  if (hasRange) {
    if (!q.dueFrom || !q.dueTo) throw validationError({ dueFrom: 'dueFrom and dueTo go together' })
    const days = (toDate(q.dueTo).getTime() - toDate(q.dueFrom).getTime()) / DAY_MS
    if (days < 0) throw validationError({ dueTo: 'dueTo must not be before dueFrom' })
    if (days > 31) throw validationError({ dueTo: 'The range can be at most 31 days' })
  }
  if (q.overdueBefore && q.completed === true) {
    throw validationError({ completed: 'overdueBefore only returns incomplete todos' })
  }

  if (q.tagId) {
    const tag = await prisma.tag.findFirst({ where: { id: q.tagId, userId } })
    if (!tag) throw notFound()
  }

  const where: Prisma.TodoWhereInput = { userId }
  if (q.dueFrom && q.dueTo) where.dueDate = { gte: toDate(q.dueFrom), lte: toDate(q.dueTo) }
  if (q.unscheduled) where.dueDate = null
  if (q.overdueBefore) {
    where.dueDate = { lt: toDate(q.overdueBefore) }
    where.completed = false
  }
  if (q.completed !== undefined && !q.overdueBefore) where.completed = q.completed
  if (q.priority) where.priority = q.priority
  if (q.tagId) where.tags = { some: { tagId: q.tagId } }

  const [items, total] = await Promise.all([
    prisma.todo.findMany({
      where,
      include,
      orderBy: [
        { dueDate: 'asc' },
        { completed: 'asc' },
        { priority: 'desc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      take: q.limit,
      skip: q.offset,
    }),
    prisma.todo.count({ where }),
  ])

  res.status(200).json({ items: items.map(toDto), total, limit: q.limit, offset: q.offset })
})

todosRouter.post('/', async (req, res) => {
  const userId: string = res.locals.userId
  const body = parseBody(createSchema, req.body)
  const ids = body.tagIds ?? []
  await assertOwnedTags(userId, ids)

  const todo = await prisma.todo.create({
    data: {
      userId,
      title: body.title,
      dueDate: body.dueDate ? toDate(body.dueDate) : null,
      priority: body.priority,
      tags: { create: ids.map((tagId) => ({ tagId })) },
    },
    include,
  })
  res.status(201).json(toDto(todo))
})

todosRouter.get('/:id', async (req, res) => {
  const id = requireUuid(req.params.id)
  const todo = await prisma.todo.findFirst({ where: { id, userId: res.locals.userId }, include })
  if (!todo) throw notFound()
  res.status(200).json(toDto(todo))
})

todosRouter.patch('/:id', async (req, res) => {
  const userId: string = res.locals.userId
  const id = requireUuid(req.params.id)
  const body = parseBody(updateSchema, req.body)

  const owned = await prisma.todo.findFirst({ where: { id, userId }, select: { id: true } })
  if (!owned) throw notFound()
  if (body.tagIds) await assertOwnedTags(userId, body.tagIds)

  const data: Prisma.TodoUpdateInput = {
    title: body.title,
    completed: body.completed,
    priority: body.priority,
  }
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? toDate(body.dueDate) : null
  if (body.tagIds) {
    data.tags = { deleteMany: {}, create: body.tagIds.map((tagId) => ({ tagId })) }
  }

  const todo = await prisma.todo.update({ where: { id }, data, include })
  res.status(200).json(toDto(todo))
})

todosRouter.delete('/:id', async (req, res) => {
  const id = requireUuid(req.params.id)
  const { count } = await prisma.todo.deleteMany({ where: { id, userId: res.locals.userId } })
  if (count === 0) throw notFound()
  res.status(204).end()
})
