# ADR 0012: Backend tooling: Express, Prisma, Zod

**Status:** Accepted

Three related decisions on how the Node/TypeScript API (ADR 0001) is built. Prisma is the most significant and is justified in detail.

## A. Web framework: Express

- **Problem:** Node alone gives low-level HTTP; we need routing, middleware (session check, CSRF/Origin check, rate limiting), and error handling.
- **Pros:** Most widely used Node framework; huge middleware ecosystem (cookies, rate limiting); simple to explain; very reliable Copilot output.
- **Cons:** Not designed for TypeScript; no built-in validation (solved by Zod); less structure, so we impose our own folder conventions.
- **Rejected:** *Fastify* (faster and has built-in schemas, but speed is irrelevant when the database is the bottleneck, and its ecosystem is smaller). *NestJS* (enforced structure, but heavy boilerplate and a steep learning curve for a one-week project).

## B. Database access: Prisma ORM

- **Problem:** The API receives requests as JSON, but PostgreSQL understands SQL. Something must translate safely and correctly. We also need versioned schema changes (migrations).

### Why Prisma (detailed justification)
1. **One source of truth.** The `schema.prisma` file defines tables, relations, enums, and indexes. Prisma generates both the migration SQL and the TypeScript types from it, so the database and the code cannot drift apart.
2. **Type safety catches mistakes before runtime.** A misspelled column (`priorty`) or a wrong value (`priority: "banana"`) is flagged in the editor. With raw SQL these show up only at runtime. This matters because Copilot writes most of the code; the compiler checks its work.
3. **Our data model maps cleanly.** Todos <-> tags is many-to-many (`todo_tags`). Prisma models it as a relation, and `include: { tags: true }` fetches todos with their tags in one round of queries, avoiding the N+1 problem (1 query for 20 todos plus 20 for their tags).
4. **Spec requirements are declarative.** The enum `priority`, cascade deletes (`onDelete: Cascade`), the per-user unique tag `(userId, lower(name))`, and indexes such as `(userId, dueDate)` are declared in the schema. Where Prisma cannot express something (the case-insensitive unique index), a hand-written SQL migration is used.
5. **Built-in migrations.** `prisma migrate` creates reproducible, versioned changes that run the same way in Docker, tests, and production.
6. **SQL injection protection by default.** Queries are parameterized; user input is never concatenated into SQL.
7. **Fewer lines means fewer mistakes.** Less hand-written data-access code reduces the surface where an incorrect `WHERE user_id = ?` could leak another user's data. Ownership checks stay short and easy to review.
8. **Connection pooling and scale.** Prisma maintains a connection pool per API instance (sized small per ADR 0006). At our scale (~10M rows, per-user queries on indexed columns) ORM overhead is negligible next to database time; the indexes matter far more than the access layer.
9. **Escape hatch.** `prisma.$queryRaw` allows raw parameterized SQL for any query Prisma handles awkwardly.

### Cons / tradeoffs (acknowledged)
- Hides SQL, so we learn less raw SQL. Mitigation: enable query logging and review the generated SQL for the list endpoint with `EXPLAIN`.
- Some advanced features (partial or expression indexes, certain filters) need raw SQL migrations.
- Adds a generated client and a build step (`prisma generate`).
- Slightly heavier runtime and larger Docker image than `pg`.
- Risk of N+1 queries if relations are loaded carelessly (mitigated with `include` and tests on query count).

### Alternatives considered
| Alternative | Why rejected |
|---|---|
| Raw SQL with `pg` | Maximum control and SQL learning value, but no type checking, more code for Copilot to get wrong, and migrations need a separate tool. |
| Kysely (typed query builder) | Typed and close to SQL, but smaller community, and migrations and schema types are managed separately. |
| Drizzle ORM | Good and lightweight, but newer with fewer examples; Prisma's tooling and documentation are more mature for a first project. |

## C. Input validation: Zod

- **Problem:** Anyone can send the API anything; the server must validate every request (frontend checks are convenience only).
- **Decision:** One Zod schema per request body/query. Failures produce the standard `400` with a `fields` map.
- **Pros:** Rules live in one readable place; TypeScript types are inferred; schemas can be shared with the React frontend; consistent error format.
- **Cons:** One more dependency; developers must remember to apply it on every route (enforced with tests for each 400 criterion).
- **Rejected:** *express-validator* (Express-specific, weaker typing, cannot be shared with the frontend). *Hand-written checks* (repetitive, inconsistent, easy to forget a case).

## Consequences
Each spec rule (title 1-200, tag 1-30, max 10 tags, password >= 8, valid priority/sort/limit) is a Zod schema line. The data model is defined in `schema.prisma`, and all schema changes go through migrations.
