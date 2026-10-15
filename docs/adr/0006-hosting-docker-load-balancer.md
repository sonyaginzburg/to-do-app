# ADR 0006: Hosting and scaling: Docker containers behind a load balancer

**Status:** Accepted

## Context
One server cannot safely serve 100k users: it is a single point of failure and limits capacity. The API is stateless (ADR 0004/0005), so it can run as several identical copies.

## Problem it solves
How the API, database, and cache run, and how capacity is added.

## Decision
Package the API as a **Docker** image and run 2+ instances behind a **load balancer** (nginx locally). Locally, **Docker Compose** runs: nginx (also serves the static frontend), API x2+, PostgreSQL, Redis. In production, target managed containers with managed PostgreSQL and Redis.

## Pros
- Directly demonstrates horizontal scaling and failover (a dead instance is skipped).
- Identical environment on laptop and cloud.
- Easy local demo and Playwright testing.
- Portable across cloud providers.

## Cons / tradeoffs
- More configuration (images, health checks, deploys).
- We operate more pieces than with a PaaS.
- The database remains the scaling bottleneck (mitigated with indexes, pooling, replicas).

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Serverless (Lambda/functions) | Cold starts; many concurrent functions can exhaust PostgreSQL connections (needs a pooler); awkward to run locally; less visible architecture. |
| PaaS (Render/Railway/Fly.io) | Fastest to deploy but hides the scaling mechanics this project aims to demonstrate; less control; cost grows quickly. |

## Consequences
API instances must be stateless and expose a health endpoint. Each instance uses a small DB connection pool.
