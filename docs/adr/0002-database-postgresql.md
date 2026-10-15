# ADR 0002: Primary database: PostgreSQL

**Status:** Accepted

## Context
Data is relational: users own todos, users own tags, todos have many tags. Users filter and sort todos by status, priority, tag, and due date. Estimated scale: 100k users x ~100 todos = ~10M todo rows.

## Problem it solves
Durable, consistent storage of all application data, with efficient filtering and sorting.

## Decision
Use **PostgreSQL**.

## Pros
- Relationships (foreign keys, many-to-many via join table) are first-class.
- Strong transactions and consistency.
- Composite indexes (e.g. `(user_id, due_date)`) make per-user filtered/sorted queries fast.
- 10M rows is comfortable for a single instance; read replicas are available when needed.
- Mature, widely supported managed offerings.

## Cons / tradeoffs
- Schema changes require migrations.
- Scales vertically first; horizontal write scaling (sharding) is harder.
- Connection count is limited, so use a connection pool.

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| MongoDB | Flexible schema isn't needed; many-to-many tags and multi-field filtering are awkward; weaker relational guarantees. |
| DynamoDB | Needs access patterns designed upfront; filtering by due date + priority + tag is hard; vendor lock-in. |

## Consequences
Every table is user-owned and indexed on `user_id`. Use a connection pool and migrations. If load grows: add read replicas, then consider partitioning by `user_id`.
