import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from './db.js'

let counter = 0
const uniqueEmail = () => `schema-${Date.now()}-${counter++}@test.com`

async function makeUser() {
  return prisma.user.create({ data: { email: uniqueEmail(), passwordHash: 'x' } })
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: 'schema-' } } })
  await prisma.$disconnect()
})

describe('database schema', () => {
  it('generates UUID ids and applies defaults', async () => {
    const user = await makeUser()
    const todo = await prisma.todo.create({ data: { userId: user.id, title: 'Buy milk' } })
    expect(todo.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/)
    expect(todo.completed).toBe(false)
    expect(todo.priority).toBe('medium')
    expect(todo.dueDate).toBeNull()
  })

  it('rejects a duplicate email', async () => {
    const user = await makeUser()
    await expect(
      prisma.user.create({ data: { email: user.email, passwordHash: 'x' } }),
    ).rejects.toThrow()
  })

  it('rejects an uppercase email', async () => {
    await expect(
      prisma.user.create({ data: { email: 'UPPER-schema@test.com', passwordHash: 'x' } }),
    ).rejects.toThrow()
  })

  it('rejects an empty or 201-character title', async () => {
    const user = await makeUser()
    await expect(prisma.todo.create({ data: { userId: user.id, title: '' } })).rejects.toThrow()
    await expect(
      prisma.todo.create({ data: { userId: user.id, title: 'a'.repeat(201) } }),
    ).rejects.toThrow()
    const ok = await prisma.todo.create({ data: { userId: user.id, title: 'a'.repeat(200) } })
    expect(ok.title).toHaveLength(200)
  })

  it('rejects an invalid priority', async () => {
    const user = await makeUser()
    await expect(
      prisma.$executeRaw`INSERT INTO todos (user_id, title, priority) VALUES (${user.id}::uuid, 'x', 'urgent'::"Priority")`,
    ).rejects.toThrow()
  })

  it('keeps tag names unique per user, ignoring case', async () => {
    const a = await makeUser()
    const b = await makeUser()
    await prisma.tag.create({ data: { userId: a.id, name: 'Work' } })
    await expect(prisma.tag.create({ data: { userId: a.id, name: 'work' } })).rejects.toThrow()
    const other = await prisma.tag.create({ data: { userId: b.id, name: 'work' } })
    expect(other.name).toBe('work')
  })

  it('rejects tag names that are empty or longer than 30 characters', async () => {
    const user = await makeUser()
    await expect(prisma.tag.create({ data: { userId: user.id, name: '' } })).rejects.toThrow()
    await expect(
      prisma.tag.create({ data: { userId: user.id, name: 'a'.repeat(31) } }),
    ).rejects.toThrow()
  })

  it('rejects the same tag twice on one todo', async () => {
    const user = await makeUser()
    const todo = await prisma.todo.create({ data: { userId: user.id, title: 't' } })
    const tag = await prisma.tag.create({ data: { userId: user.id, name: 'dup' } })
    await prisma.todoTag.create({ data: { todoId: todo.id, tagId: tag.id } })
    await expect(
      prisma.todoTag.create({ data: { todoId: todo.id, tagId: tag.id } }),
    ).rejects.toThrow()
  })

  it('cascades deletes from user to todos, tags and todo_tags', async () => {
    const user = await makeUser()
    const todo = await prisma.todo.create({ data: { userId: user.id, title: 't' } })
    const tag = await prisma.tag.create({ data: { userId: user.id, name: 'c' } })
    await prisma.todoTag.create({ data: { todoId: todo.id, tagId: tag.id } })

    await prisma.user.delete({ where: { id: user.id } })

    expect(await prisma.todo.count({ where: { id: todo.id } })).toBe(0)
    expect(await prisma.tag.count({ where: { id: tag.id } })).toBe(0)
    expect(await prisma.todoTag.count({ where: { todoId: todo.id } })).toBe(0)
  })

  it('deleting a tag removes it from todos but keeps the todo', async () => {
    const user = await makeUser()
    const todo = await prisma.todo.create({ data: { userId: user.id, title: 't' } })
    const tag = await prisma.tag.create({ data: { userId: user.id, name: 'gone' } })
    await prisma.todoTag.create({ data: { todoId: todo.id, tagId: tag.id } })

    await prisma.tag.delete({ where: { id: tag.id } })

    expect(await prisma.todo.count({ where: { id: todo.id } })).toBe(1)
    expect(await prisma.todoTag.count({ where: { todoId: todo.id } })).toBe(0)
  })

  it('stores due_date as a date without a time', async () => {
    const user = await makeUser()
    const todo = await prisma.todo.create({
      data: { userId: user.id, title: 't', dueDate: new Date('2026-10-15') },
    })
    expect(todo.dueDate?.toISOString().slice(0, 10)).toBe('2026-10-15')
  })
})
