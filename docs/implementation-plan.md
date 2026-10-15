# Implementation plan and Git workflow

Source of truth: `docs/spec.md` and `docs/adr/`. Every prompt below tells Copilot to follow them.

## Part 1: Git workflow (professional conventions)

### One-time setup

1. Create an empty GitHub repo (`todo-app`, public, add a MIT license and a Node `.gitignore`). No code yet.
2. `git clone` it, create the folders `backend/`, `frontend/`, `e2e/`, `docs/`; copy `spec.md` and `adr/` into `docs/`.
3. Add `.gitignore` entries: `node_modules/`, `.env`, `dist/`, `playwright-report/`, `test-results/`.
4. First commit directly on `main`: `docs: add spec and architecture decision records`. Push.
5. On GitHub: Settings -> Branches -> protect `main` (require a pull request before merging). Settings -> General -> allow only **squash merging**, so `main` has one clean commit per PR.

### Branching

- Model: **GitHub Flow** (decided). There is no `develop` branch; short-lived feature branches merge straight into `main`, and `v1.0.0` is tagged and released at the end.
- `main` is always working. Never commit to it after step 4.
- One branch per phase, named `type/short-description`: `feat/api-auth`, `feat/board-ui`, `test/e2e-board`, `chore/docker-compose`, `docs/readme`.
- Branch from an up-to-date `main`: `git switch main; git pull; git switch -c feat/api-auth`.

### Commits (Conventional Commits)

Format: `type(scope): imperative summary` (under 72 characters).
Types: `feat`, `fix`, `test`, `docs`, `chore` (tooling), `refactor`, `ci`.
Examples:

- `feat(api): add register and login endpoints`
- `test(api): cover cross-user access returns 404 (AC5.2)`
- `chore(docker): add nginx load balancer config`

Rules: small commits, one idea each; commit tests with the feature they cover; never commit secrets or `.env`; reference the criteria in messages (for example `AC7.3`).

### Pull requests

1. Push the branch, then `gh pr create` (or use the GitHub page).
2. Title is a Conventional Commit. Description includes: what and why, which user stories and ACs it covers, how to test it, and screenshots for UI work.
3. Wait for CI (Phase 0 adds it) to pass, read your own diff, and squash-merge.
4. Delete the branch, then `git switch main; git pull`.
5. Use a GitHub Issue per phase (for example "Phase 2: Todo API") and put `Closes #N` in the PR. This gives a visible project history.

### Other things employers notice

- A clear README (what it is, a screenshot or GIF of the board, architecture diagram, `docker compose up` quickstart, how to run tests, link to the ADRs).
- Tags and releases: `v1.0.0` after the demo.
- A green CI badge in the README.
- No large generated files, no secrets in history.
- You review what Copilot wrote before merging. Copilot-authored commits are fine; add the trailer `Co-authored-by` if you want to be transparent.

## Part 2: Phases and prompts

General rule: give Copilot **one phase at a time**, run the tests, fix, commit, PR, merge, and only then continue. Start each phase with a fresh branch.

Preamble to include in every prompt:

> Follow `docs/spec.md` and the ADRs in `docs/adr/` exactly. Do not add features that are not in the spec. If something is unclear or conflicts, stop and ask me. Write tests alongside the code. Make small commits using Conventional Commits. Do not commit secrets.

### Phase 0: Scaffolding and CI (`chore/scaffold`)

> Set up the monorepo per spec section 1a: `/backend` (Node, TypeScript, Express, Prisma, Zod, a test runner such as Vitest plus Supertest), `/frontend` (React, Vite, TypeScript, React Router, TanStack Query), `/e2e` (Playwright). Add ESLint and Prettier, a root README stub, `.env.example` (spec 6c), and a GitHub Actions workflow that installs, lints, type-checks and runs unit tests on every PR. Do not implement features yet.

Done when: CI is green on the PR.

### Phase 1: Database (`feat/database`)

> Implement the Prisma schema for spec section 2 (users, todos, tags, todo_tags, UUID keys, enums, constraints, indexes, cascades, case-insensitive unique tag names). Create the initial migration and a Prisma client module. Add tests that verify the constraints (unique email, tag uniqueness per user, cascade delete).

### Phase 2: Auth API (`feat/api-auth`) covers US1, US2, ADR 0004, 0005, 0011

> Implement the auth endpoints in spec section 4 with Zod validation, argon2 hashing, Redis sessions that store a SHA-256 hash of the session id (spec section 3 and Sessions), the `sid` cookie flags, the Origin-check CSRF middleware, login rate limiting (429), the standard error format and `/health`. Write API integration tests for every AC of US1 and US2 plus AC7.5-style CSRF checks and 429.

### Phase 3: Todo and tag API (`feat/api-todos`) covers US3, US5-US10, US12, US13 (API parts)

> Implement `/todos` and `/tags` per spec section 4, including the three query scopes (week range, unscheduled, overdue), filters, fixed ordering, limit/offset with `total`, the 10-tags-per-todo rule, per-user ownership with 404 for other users' resources, and Zod validation. Write integration tests for every API-level acceptance criterion, including AC4.4, AC4.5, and cross-user access for every endpoint.
> Tip: split into two PRs, tags first, then todos.

### Phase 4: Frontend foundation (`feat/frontend-auth`) covers US1, US2 UI

> Build the register and login screens, the React Router guard that redirects based on `GET /auth/me`, the API client (credentials included, standard error handling) and the CSS variables file for the paper-planner style (spec 1c). Follow ADR 0014.

### Phase 5: Board UI (`feat/board-ui`) covers US3, US4, US6, US8-US11, US13

> Build the weekly board (Overdue, Mon-Sun, Unscheduled), the week navigation and "This week" button, quick-add and the full form, completion, ordering display, tags, filters (one tag, one priority, Hide completed), the overdue reschedule button, and empty states (AC4.6, AC4.7). Use TanStack Query and CSS Modules. Show priority with stripe plus text. Follow spec 1b and 1c.

### Phase 6: Moving, delete and responsive (`feat/board-interactions`) covers US7, US12, US14

> Add dnd-kit drag and drop, the "Move to..." menu, optimistic moves with rollback, the 5-second Undo delete (client-side delayed request), and the under-900px tab layout with drag disabled.

### Phase 7: Docker (`chore/docker-compose`) covers ADR 0006 and spec 6c

> Add Dockerfiles, an nginx config (serve the built frontend, proxy `/api` round-robin, SPA fallback), and `docker-compose.yml` with nginx, 2 API replicas, postgres, redis and a migration step. Only port 8080 is published. `docker compose up` must work from a clean checkout. Add the `npm run seed` demo script.

### Phase 8: End-to-end tests (`test/e2e`) covers all UI criteria

> Write Playwright tests for every UI acceptance criterion in US1-US14, one test file per user story, named after the AC ids. Each test registers its own unique user. Use `page.clock` for date tests and a 390px viewport for US14. Add a drag-and-drop test and its non-drag equivalent. Add a root command that runs everything and a CI job that runs the Compose stack and the E2E tests. Use Playwright MCP to explore the running app and fix any selectors or bugs you find. (Assignment Days 2-3.)

### Phase 9: Polish (`docs/readme-and-retro`)

> Write the README (see Part 1), an architecture diagram, and screenshots. Verify every item in the Definition of Done (spec 6b). Then I write the retrospective in `docs/retrospective.md`.

After Phase 9: tag `v1.0.0` and write the retrospective as you go (keep a running list of where Copilot was wrong or needed correction).

## Part 3: Working habits with Copilot

- Always have Copilot run the tests and show the output before you accept a phase.
- Review the diff yourself; ask Copilot to explain anything you don't understand. You must be able to defend each decision at the demo.
- When Copilot deviates from the spec, either fix the code or change the spec/ADR deliberately (new ADR or an update), never silently.
- Keep notes for the retrospective: good prompts, bad outputs, bugs, time saved.
