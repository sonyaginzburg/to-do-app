# Architecture Decision Records

| #    | Decision             | Choice                                                                     |
| ---- | -------------------- | -------------------------------------------------------------------------- |
| 0001 | Backend              | TypeScript on Node.js                                                      |
| 0002 | Database             | PostgreSQL                                                                 |
| 0003 | Frontend             | React + Vite                                                               |
| 0004 | Authentication       | Email + password, server-side sessions                                     |
| 0005 | Session store        | Redis                                                                      |
| 0006 | Hosting and scaling  | Docker containers behind a load balancer                                   |
| 0007 | API style            | REST + JSON                                                                |
| 0008 | Testing              | Playwright E2E + API integration tests                                     |
| 0009 | Data model decisions | Per-user tags, fixed priority, hard delete with UI undo, offset pagination |
| 0010 | Primary keys         | UUIDs                                                                      |
| 0011 | Security controls    | Rate limiting, CSRF, ownership checks                                      |
| 0012 | Backend tooling      | Express, Prisma ORM, Zod validation                                        |
| 0013 | UI layout            | Weekly planner board with drag and drop (dnd-kit)                          |
| 0014 | Frontend libraries   | TanStack Query, CSS Modules, React Router                                  |

Each ADR lists context, decision, pros/cons, rejected alternatives, and consequences. See `../spec.md` for the specification.
