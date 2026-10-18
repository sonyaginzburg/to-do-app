import argon2 from 'argon2'
import { prisma } from './db.js'
import { redis } from './redis.js'

// Demo data for presentations. Run with: npm run seed (see README). Safe to re-run:
// it deletes the demo user (and their todos and tags) and builds it again.
const EMAIL = 'demo@example.com'
const PASSWORD = 'demo-password-1'

type Priority = 'low' | 'medium' | 'high'

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const now = new Date()
const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
const weekday = (offset: number) =>
  iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset))
const daysAgo = (n: number) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n))

const tagNames = ['school', 'work', 'home', 'health']

const todos: {
  title: string
  dueDate: string | null
  priority: Priority
  completed?: boolean
  tags?: string[]
}[] = [
  {
    title: 'Finish internship project demo',
    dueDate: weekday(0),
    priority: 'high',
    tags: ['work'],
  },
  {
    title: 'Team stand-up notes',
    dueDate: weekday(0),
    priority: 'low',
    completed: true,
    tags: ['work'],
  },
  { title: 'Read chapter 4 for class', dueDate: weekday(1), priority: 'medium', tags: ['school'] },
  { title: 'Grocery shopping', dueDate: weekday(2), priority: 'low', tags: ['home'] },
  { title: 'Dentist appointment', dueDate: weekday(2), priority: 'high', tags: ['health'] },
  { title: 'Submit lab report', dueDate: weekday(3), priority: 'high', tags: ['school'] },
  { title: 'Go for a run', dueDate: weekday(4), priority: 'medium', tags: ['health'] },
  { title: 'Clean the apartment', dueDate: weekday(5), priority: 'low', tags: ['home'] },
  { title: 'Plan next week', dueDate: weekday(6), priority: 'medium' },
  { title: 'Return library books', dueDate: daysAgo(3), priority: 'medium', tags: ['school'] },
  { title: 'Pay electricity bill', dueDate: daysAgo(8), priority: 'high', tags: ['home'] },
  { title: 'Learn a new recipe', dueDate: null, priority: 'low', tags: ['home'] },
  { title: 'Look into conferences', dueDate: null, priority: 'medium', tags: ['work', 'school'] },
]

try {
  await prisma.user.deleteMany({ where: { email: EMAIL } })
  const user = await prisma.user.create({
    data: { email: EMAIL, passwordHash: await argon2.hash(PASSWORD) },
  })

  const tagIds = new Map<string, string>()
  for (const name of tagNames) {
    const tag = await prisma.tag.create({ data: { userId: user.id, name } })
    tagIds.set(name, tag.id)
  }

  for (const todo of todos) {
    await prisma.todo.create({
      data: {
        userId: user.id,
        title: todo.title,
        priority: todo.priority,
        completed: todo.completed ?? false,
        dueDate: todo.dueDate ? new Date(`${todo.dueDate}T00:00:00.000Z`) : null,
        tags: { create: (todo.tags ?? []).map((name) => ({ tagId: tagIds.get(name)! })) },
      },
    })
  }

  console.log(`Seeded ${EMAIL} (password: ${PASSWORD}) with ${todos.length} todos.`)
} finally {
  await prisma.$disconnect()
  redis.disconnect()
}
