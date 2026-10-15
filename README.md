# To-do planner

A weekly planner to-do app designed to scale to 100k users.

> Work in progress. The full README is added in the final phase.

## Documentation

- [Specification](docs/spec.md)
- [Architecture decision records](docs/adr/README.md)
- [Implementation plan](docs/implementation-plan.md)

## Structure

- `backend/` Node, TypeScript, Express API
- `frontend/` React, Vite, TypeScript
- `e2e/` Playwright end-to-end tests
- `docs/` spec and ADRs

## Development

```
npm install
docker run -d --name todo-pg-dev -e POSTGRES_USER=todo -e POSTGRES_PASSWORD=todo -e POSTGRES_DB=todo -p 5433:5432 postgres:17
docker run -d --name todo-redis-dev -p 6380:6379 redis:7
echo DATABASE_URL=postgresql://todo:todo@localhost:5433/todo > backend/.env
npm run db:migrate -w backend
npm run lint
npm run typecheck
npm test
```
