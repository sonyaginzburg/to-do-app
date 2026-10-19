# To-do planner

A weekly planner to-do app with a paper-planner look, designed to scale to 100k users.

![The weekly board](docs/screenshots/board.png)

You see one week as columns (Overdue, Monday to Sunday, Unscheduled). Todos can be dragged between days, tagged, prioritised, filtered and completed. On a phone the columns become tabs.

<img src="docs/screenshots/board-mobile.png" alt="The board on a small screen" width="300">

## Quick start (Docker)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) running (no Docker login needed).

```powershell
# 1. Create your private settings file from the template
Copy-Item .env.example .env

# 2. Generate a database password and paste it after POSTGRES_PASSWORD= in .env
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

# 3. Start everything: nginx, 2 API instances, PostgreSQL, Redis
docker compose up -d --build --wait

# 4. (Optional) fill the board with demo data
docker compose exec api npm run seed -w backend
```

Open http://localhost:8080. The demo login after seeding is `demo@example.com` / `demo-password-1`.

Stop it with `docker compose down` (add `-v` to also delete the database).

`.env` is gitignored. Never commit it. `.env.example` only lists the variable names.

## Architecture

```mermaid
flowchart LR
    Browser -->|port 8080| Nginx
    Nginx -->|/api round-robin| API1[API instance 1]
    Nginx -->|/api round-robin| API2[API instance 2]
    API1 --> PG[(PostgreSQL)]
    API2 --> PG
    API1 --> Redis[(Redis sessions)]
    API2 --> Redis
```

- **nginx** is the only service published to the host (port 8080). It serves the built React app and spreads `/api` requests across the API instances.
- **API** is stateless (Node, Express, Prisma, Zod). Logins are stored in **Redis**, so any instance can serve any request. To handle more users, add API replicas.
- **PostgreSQL** holds users, todos and tags. Postgres and Redis are only reachable inside the Docker network.
- A one-off `migrate` step applies database migrations before the APIs start.

### Why these choices

Every major decision has an ADR (context, options, trade-offs) in [docs/adr](docs/adr/README.md). The requirements and acceptance criteria are in the [specification](docs/spec.md).

| Area     | Choice                                                         |
| -------- | -------------------------------------------------------------- |
| Backend  | TypeScript, Node, Express 5, Prisma 7, Zod                     |
| Database | PostgreSQL (UUID keys)                                         |
| Sessions | Server-side sessions in Redis, cookie `sid`                    |
| Frontend | React 19, Vite, TanStack Query, CSS Modules, dnd-kit           |
| Security | Argon2 password hashing, rate limiting, CSRF, ownership checks |
| Tests    | Vitest API integration tests, Playwright end-to-end tests      |

## Project structure

- `backend/` API, Prisma schema and migrations, seed script
- `frontend/` React app
- `nginx/` nginx image and config
- `e2e/` Playwright tests (one file per user story)
- `docs/` specification, ADRs, implementation plan

## Running the tests

**End-to-end tests** (Playwright). This starts a separate, disposable Docker stack (`todo-e2e`) with its own database, runs every acceptance criterion in a real browser, then removes it:

```powershell
npm install
npx playwright install chromium   # first time only
npm run test:e2e
```

**API integration tests** (Vitest) need a development PostgreSQL and Redis. They use these throwaway containers (their password is only for local testing):

```powershell
docker run -d --name todo-pg-dev -e POSTGRES_USER=todo -e POSTGRES_PASSWORD=todo -e POSTGRES_DB=todo -p 5433:5432 postgres:17
docker run -d --name todo-redis-dev -p 6380:6379 redis:7
Set-Content backend\.env "DATABASE_URL=postgresql://todo:todo@localhost:5433/todo"
npm run db:migrate -w backend
npm test
```

**Everything at once** (after the dev containers above are running):

```powershell
npm run test:all
```

**Code quality checks** (also run in CI on every pull request): `npm run lint`, `npm run format:check`, `npm run typecheck`.

## Development without Docker for the app

With the dev containers above running:

```powershell
npm run dev -w backend    # API on port 3000
npm run dev -w frontend   # app on http://localhost:5173
```

Set `ALLOWED_ORIGIN=http://localhost:5173` for the API when using the Vite dev server.

## Workflow

Work happens on short-lived branches and pull requests into `main`, which is protected. Commits follow [Conventional Commits](https://www.conventionalcommits.org/). GitHub Actions runs two jobs on every pull request: `check` (lint, format, types, unit and API tests, build) and `e2e` (the full Playwright suite against the Docker stack).
