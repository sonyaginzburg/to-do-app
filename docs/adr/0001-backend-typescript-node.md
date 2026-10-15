# ADR 0001: Backend language and runtime: TypeScript on Node.js

**Status:** Accepted

## Context

The backend exposes a REST API for a to-do app that must scale to 100k users. The workload is I/O-bound CRUD (database reads/writes), not CPU-heavy. The backend must be stateless so it can run as multiple copies behind a load balancer.

## Problem it solves

Runs the business logic: authentication, validation, authorization (users only access their own data), and database access.

## Decision

Use **TypeScript on Node.js**.

## Pros

- One language across frontend and backend, so shared types and less context switching.
- Node's async I/O model suits CRUD APIs that spend most time waiting on the database.
- Large ecosystem; Copilot generates TypeScript very reliably.
- Static types catch many bugs before runtime.

## Cons / tradeoffs

- Single-threaded per process: CPU-heavy work would block it (not an issue here). Scale by running more processes/containers.
- Express alone has little structure; conventions must be enforced by us.
- Compilation step (TypeScript -> JavaScript).

## Alternatives considered

| Alternative      | Why rejected                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Python + FastAPI | Great developer experience, but lower raw throughput per process, and it would split the stack into two languages.  |
| C# / .NET        | Excellent performance and typing, but heavier tooling and ceremony, and no shared language with the React frontend. |

## Consequences

Scaling is horizontal (more containers). Frontend and backend can share type definitions.
