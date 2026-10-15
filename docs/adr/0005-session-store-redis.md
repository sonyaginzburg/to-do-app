# ADR 0005: Session store: Redis

**Status:** Accepted

## Context
Sessions are tiny (`session id -> user id`), temporary, and read on every authenticated request. At 100k users this is thousands of lookups per second at peak.

## Problem it solves
Fast, shared session lookup for all API instances, without loading the main database.

## Decision
Store sessions in **Redis** with a TTL (automatic expiry).

## Pros
- Sub-millisecond in-memory lookups.
- Built-in expiry, so no cleanup job.
- Keeps session reads off PostgreSQL so it serves todo data.
- Can later be reused for caching and login rate limiting.

## Cons / tradeoffs
- One more service to run, monitor, and secure.
- In-memory: a restart can lose sessions unless persistence is configured (users simply log in again).
- If Redis is down, nobody can authenticate (mitigate with a managed/replicated Redis).

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Sessions table in PostgreSQL | Fewer systems, but adds a DB read to every request, competing with todo queries; needs an expiry cleanup job. |
| Both Redis and PostgreSQL | Most durable but unnecessary complexity for this app. |

## Consequences
API stays stateless; Docker Compose includes a Redis service.
