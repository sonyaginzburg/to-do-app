# To-Do App Specification

Target: 100k users. Stack and rationale are in `docs/adr/`.
All parameters in this spec have been confirmed.

## 1. Architecture summary

Browser (React + Vite SPA) -> nginx load balancer -> 2+ stateless API instances (Node/TypeScript, REST+JSON) -> PostgreSQL (data) and Redis (sessions). All run via Docker Compose locally.

**Serving (decided):** nginx is the single entry point at `http://localhost:8080`. It serves the built React files at `/` (with fallback to `index.html` for client-side routes) and proxies `/api/*` to the API instances (round-robin). The browser sees one origin, so no CORS is needed and cookies stay `SameSite=Lax`. In development, Vite's dev server proxies `/api` to the API to mimic this. Compose services: `nginx`, `api` (2 replicas), `postgres`, `redis`.

## 1b. Product layout: weekly planner board (see ADR 0013)

The main screen (`/`) is a weekly planner board, modeled on planning a week on paper. Each todo sits in the column of the day it is due.

**Columns (left to right):** Overdue, Mon, Tue, Wed, Thu, Fri, Sat, Sun, Unscheduled. The week starts on Monday and always shows all 7 days. Overdue and Unscheduled are always visible, whichever week is shown.

**Screens and routes:** `/register` and `/login` (logged-out users only; logged-in users are redirected to `/`) and `/` (the board; logged-out users are redirected to `/login`).

**Top bar:** Previous week / This week / Next week buttons with the date range, filter chips (tag, priority), a "Hide completed" toggle, "Manage tags", "New todo", and the user's email with Log out.

**Cards:** checkbox, title, tag chips, priority shown as a colored stripe **plus a text label** (never color alone), and a menu with Edit, Move to..., and Delete. The column itself shows the date. Today's column is highlighted when the visible week contains today.

**Modals:** Edit todo, New todo (full form: title, due date, priority, tags), and Manage tags open as modals. They close with Esc and keep keyboard focus inside while open.

**Rules**

- **Today** is the browser's local date. The browser sends it to the API where needed; the server never guesses time zones. Due dates are plain dates.
- **Overdue** = incomplete todos with a due date before today. It has no quick-add input. Each card has a "Reschedule to today" button. Completed todos are never overdue; they stay in their original day.
- **Unscheduled** = todos with no due date.
- **Ordering inside every column:** incomplete first, then priority (high, medium, low), then oldest created first, then `id`. Overdue is ordered by due date (oldest first) before these rules. Completed todos stay in their day, are struck through, and sink to the bottom.
- **Adding:** a quick-add input at the bottom of each day column and of Unscheduled (Enter creates a todo with that day's date, medium priority, no tags), plus the "New todo" button for the full form.
- **Moving a todo to another day:** drag and drop, the edit form's date picker, or the card's "Move to..." menu. All three send `PATCH /todos/:id` with a new `dueDate`. Dropping on Unscheduled sets `dueDate` to null. Overdue is not a drop target. Moves are optimistic: the card moves immediately and returns to its original column with an error message if the request fails.
- **Filters:** at most one tag, one priority, and a Hide completed toggle. They combine (AND), apply to every column, persist when changing weeks, and show as chips with a "Clear filters" button.
- **Responsive:** at 900px or wider, the full board. Below 900px, a tab bar (Overdue, Mon..Sun, Unscheduled) shows one column at a time. The default tab is today if it's in the viewed week, otherwise Monday. Drag and drop is disabled on narrow screens; use "Move to...".
- **Delete:** the card disappears immediately with a 5-second Undo toast; the API call is sent only after the toast expires (ADR 0009 C).

## 1c. Visual style: paper planner

- **Look:** warm cream background, thin ruled lines between sections, soft card shadows, rounded corners. A card being dragged tilts slightly and lifts with a larger shadow.
- **Typography:** a handwriting-style font (e.g. Caveat, self-hosted, no external requests) for column headings and the app title only. A plain, readable system sans-serif for all card text, buttons, and forms.
- **Starting palette (adjust as needed, but keep contrast rules):** background `#FBF7EE`, text `#2B2B2B`, accent teal `#1F7A74`; priority high `#C0392B`, medium `#B7791F`, low `#2F855A`.
- **Colors are CSS variables** defined in one place, so the theme can be changed later.
- **Accessibility:** normal text must have at least 4.5:1 contrast against its background; priority always shows a text label as well as color; keyboard focus is clearly visible; animations are disabled when the user's system requests reduced motion (`prefers-reduced-motion`).
- **No dark mode** in this version (listed as out of scope).

## 1a. Implementation tooling (see ADR 0012)

- **Express** for the HTTP API.
- **Prisma ORM** for database access and migrations. The data model below is implemented in `schema.prisma`, which is the single source of truth for tables, relations, enums, and indexes. Rationale: type safety (Copilot's code is checked by the compiler), generated migrations, clean many-to-many tags with `include` to avoid N+1 queries, parameterized queries against SQL injection, shorter ownership-check code, and a raw-SQL escape hatch (`$queryRaw`) for what Prisma can't express (e.g. the case-insensitive unique tag index). Tradeoffs: hides SQL and adds a generate step. Full justification and rejected alternatives (raw `pg`, Kysely, Drizzle) are in ADR 0012.
- **Zod** for validating every request; failures return the 400 format in section 3.
- **Frontend (see ADR 0014):** TanStack Query for server data (caching, optimistic moves with rollback), plain CSS Modules with CSS variables for styling, React Router for the three routes, and dnd-kit for drag and drop (ADR 0013).

## 2. Data model (PostgreSQL)

### users

| Column        | Type        | Notes                                        |
| ------------- | ----------- | -------------------------------------------- |
| id            | UUID PK     |                                              |
| email         | text        | unique, stored lowercase, valid email format |
| password_hash | text        | argon2                                       |
| created_at    | timestamptz | default now()                                |

### todos

| Column                  | Type                                | Notes                                |
| ----------------------- | ----------------------------------- | ------------------------------------ |
| id                      | UUID PK                             | UUIDs avoid guessable sequential IDs |
| user_id                 | UUID FK -> users, ON DELETE CASCADE | owner                                |
| title                   | text                                | required, 1-200 chars                |
| completed               | boolean                             | default false                        |
| priority                | enum(low, medium, high)             | default medium                       |
| due_date                | date                                | nullable (date only, no time)        |
| created_at / updated_at | timestamptz                         |                                      |

Indexes: `(user_id, due_date)`, `(user_id, priority)`, `(user_id, completed)`.

### tags

| Column  | Type                                | Notes                                          |
| ------- | ----------------------------------- | ---------------------------------------------- |
| id      | UUID PK                             |                                                |
| user_id | UUID FK -> users, ON DELETE CASCADE | owner                                          |
| name    | text                                | 1-30 chars, unique per user (case-insensitive) |

Unique: `(user_id, lower(name))`.

### todo_tags (many-to-many)

| Column  | Type                                |
| ------- | ----------------------------------- |
| todo_id | UUID FK -> todos, ON DELETE CASCADE |
| tag_id  | UUID FK -> tags, ON DELETE CASCADE  |

PK `(todo_id, tag_id)`; index on `tag_id`. A todo may have at most 10 tags. A todo may only use tags owned by the same user.

### Sessions (Redis)

Key `session:<sha256 hash of the session id>` -> `{userId}`; TTL 7 days, **sliding** (TTL is reset on use). The browser holds the random 256-bit session id in the `sid` cookie (HttpOnly); Redis stores only its SHA-256 hash, so a leaked Redis dump cannot be used to impersonate users. On each request the server hashes the cookie value and looks up the hash.

## 3. Cross-cutting rules

- Auth via session cookie (`HttpOnly`, `Secure` in prod, `SameSite=Lax`). CSRF protection on state-changing requests (POST/PATCH/DELETE): requests whose `Origin` is not our site are rejected with 403.
- Passwords: minimum 8 characters (no composition rules), hashed with argon2.
- Every todo/tag query includes `user_id = <current user>`. Accessing another user's resource returns **404**, never 403.
- Unauthenticated access to protected endpoints returns **401**.
- Validation failures return **400** with `{ "error": { "code": "...", "message": "...", "fields": {...} } }`.
- **Error examples** (all errors use the same shape; `fields` is only present for 400):
  - 400 `VALIDATION_ERROR`: `{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "fields": { "title": "Max 200 characters" } } }`
  - 401 `UNAUTHENTICATED`: `{ "error": { "code": "UNAUTHENTICATED", "message": "Please log in" } }`
  - 403 `FORBIDDEN_ORIGIN`: `{ "error": { "code": "FORBIDDEN_ORIGIN", "message": "Request origin not allowed" } }`
  - 404 `NOT_FOUND`: `{ "error": { "code": "NOT_FOUND", "message": "Not found" } }` (also used for other users' resources)
  - 409 `CONFLICT`: `{ "error": { "code": "CONFLICT", "message": "Email already registered" } }`
  - 429 `RATE_LIMITED`: `{ "error": { "code": "RATE_LIMITED", "message": "Too many attempts, try again later" } }`
  - Login failures return 401 `INVALID_CREDENTIALS` with the same message for a wrong email or a wrong password (no user enumeration).
- Rate limit login/register: 10 attempts per minute per IP, tracked in Redis. Excess requests return **429**.
- Lists are bounded: `limit` (default 50, max 200) and `offset` (default 0). The board loads three scopes in parallel: the visible week (limit 200), Overdue (limit 50), and Unscheduled (limit 50). Overdue and Unscheduled show a "Load more" button when `total` exceeds what is loaded. If a week has more than 200 matching todos, the UI shows "Showing first 200".
- The API is stateless; `GET /health` returns 200 for the load balancer.

## 4. API design (REST + JSON, base `/api`)

| Method & URL        | Purpose                                                                                | Success                             | Errors                                       |
| ------------------- | -------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------- |
| POST /auth/register | Create account and log in. Body `{email, password}`                                    | 201, sets cookie, `{id, email}`     | 400 invalid, 409 email exists                |
| POST /auth/login    | Body `{email, password}`                                                               | 200, sets cookie                    | 400, 401 generic "invalid email or password" |
| POST /auth/logout   | End session                                                                            | 204                                 | 401                                          |
| GET /auth/me        | Current user                                                                           | 200 `{id, email}`                   | 401                                          |
| GET /todos          | List my todos. Exactly one scope is required (below), plus optional filters and paging | 200 `{items, total, limit, offset}` | 400, 401                                     |
| POST /todos         | Body `{title, dueDate?, priority?, tagIds?}`                                           | 201 todo                            | 400, 401, 404 (tag not mine)                 |
| GET /todos/:id      | One todo                                                                               | 200                                 | 401, 404                                     |
| PATCH /todos/:id    | Partial update `{title?, completed?, dueDate?, priority?, tagIds?}`                    | 200 todo                            | 400, 401, 404                                |
| DELETE /todos/:id   | Permanently delete                                                                     | 204                                 | 401, 404                                     |
| GET /tags           | List my tags                                                                           | 200 `[ {id, name} ]`                | 401                                          |
| POST /tags          | Body `{name}`                                                                          | 201                                 | 400, 401, 409 duplicate                      |
| PATCH /tags/:id     | Rename `{name}`                                                                        | 200                                 | 400, 401, 404, 409                           |
| DELETE /tags/:id    | Delete tag (detaches from todos, todos remain)                                         | 204                                 | 401, 404                                     |

Todo response: `{id, title, completed, priority, dueDate, tags:[{id,name}], createdAt, updatedAt}`.
**`GET /todos` query parameters**

- **Scope (exactly one, otherwise 400):**
  - `dueFrom` + `dueTo`: inclusive `YYYY-MM-DD` range, both required together, `dueFrom <= dueTo`, at most 31 days apart (the board uses Monday to Sunday).
  - `unscheduled=true`: todos with no due date.
  - `overdueBefore=YYYY-MM-DD`: incomplete todos with `due_date` earlier than that date (the browser sends today's date). Combining it with `completed=true` returns 400.
- **Filters (optional, combined with AND):** `completed` (true/false), `priority` (low/medium/high), `tagId` (one tag, must be mine or 404).
- **Paging:** `limit`, `offset` (section 3).
- **Order (fixed, not configurable):** `overdueBefore` and range scopes sort by `due_date` ascending first (so days group together and the oldest overdue is on top). All scopes then sort by `completed` (incomplete first), `priority` (high first), `created_at` ascending, `id`.

Indexes already cover these queries: `(user_id, due_date)`, `(user_id, priority)`, `(user_id, completed)`, and `todo_tags(tag_id)`.

## 5. User stories and acceptance criteria (Given / When / Then)

### US1 Register

As a visitor, I want to create an account with email and password so that I have my own private todo list.

- AC1.1 Given I'm on the register page, when I submit a new email and valid password, then my account is created and I'm logged in.
- AC1.2 Given an account exists with my email, when I register with it, then I see "email already in use" and no account is created.
- AC1.3 Given I enter an invalid email or a password shorter than 8 characters, when I submit, then I see a validation error and no account is created.

### US2 Log in / log out

As a user, I want to sign in and out so that only I can see my todos.

- AC2.1 Given I have an account, when I enter correct credentials, then I see my weekly board.
- AC2.2 Given I enter a wrong email or password, when I submit, then I see a generic "invalid email or password" error.
- AC2.3 Given I'm logged in, when I log out, then my session ends and navigating back doesn't show my todos.
- AC2.4 Given I'm not logged in, when I call a todo endpoint, then I get 401.
- AC2.5 Given I've made 10 login attempts from one IP within a minute, when I make another, then I get 429 and the password is not checked.
- AC2.6 Given I'm logged in, when I keep using the app, then my session expiry is extended to 7 days from my last use.

### US3 Create a todo

As a user, I want to add a todo with an optional due date, priority, and tags so that I can capture what I need to do.

- AC3.1 Given I'm logged in, when I submit only a title in the New todo form, then it appears in Unscheduled as incomplete with medium priority.
- AC3.2 Given I submit an empty title (or over 200 characters), when I save, then I see an error and nothing is created.
- AC3.3 Given I choose a due date, priority, and tags, when I save, then all are shown on the todo.
- AC3.4 Given I select 11 tags, when I save, then I get 400 "A todo can have at most 10 tags" and nothing is created.
- AC3.5 Given I'm viewing a week, when I type a title in Friday's quick-add and press Enter, then a card appears in Friday's column with Friday's date, medium priority, and no tags.
- AC3.6 Given the Unscheduled column, when I use its quick-add, then the todo is created with no due date.
- AC3.7 Given I press Enter in a quick-add with an empty or whitespace-only title, then nothing is created and I see an inline error.
- AC3.8 Given I choose a due date in the New todo form, when I save, then the card appears in that date's column if it's in the visible week; if it's earlier than today it appears in Overdue.
- AC3.9 Given the Overdue column, then it has no quick-add input.

### US4 View my weekly board

As a user, I want to see my todos laid out by day so that I can see what I plan to do and when.

- AC4.1 Given today is Thu Oct 15, 2026 and I have todos due on each day of Mon Oct 12 to Sun Oct 18, when I open the board, then each todo appears in its day's column and Thursday's column is highlighted as today.
- AC4.2 Given two users each have todos, when I load my board, then I only see my own.
- AC4.3 Given a todo with no due date, when I open the board, then it appears in Unscheduled.
- AC4.4 Given I have 25 incomplete overdue todos, when I request `overdueBefore` with limit 20, then I get 20 items with total 25, and offset 20 returns the remaining 5.
- AC4.5 Given a `GET /todos` request with no scope, or with two scopes, then I get 400.
- AC4.6 Given I have no todos, when I open the board, then I see the empty columns with a helpful message such as "No todos. Add one below."
- AC4.7 Given I am a brand-new user with no todos at all, when I open the board, then I also see a hint "Add your first todo to any day"; the hint disappears once I have a todo.

### US5 Edit a todo

As a user, I want to change a todo's details so that I can fix mistakes or update plans.

- AC5.1 Given I have a todo, when I change its title, due date, priority, or tags and save, then the changes persist after reload.
- AC5.2 Given a todo belongs to another user, when I send an edit request for its ID directly to the API, then I get 404 and the todo is unchanged.

### US6 Complete / uncomplete

As a user, I want to mark todos done so that I can track progress.

- AC6.1 Given an incomplete todo, when I tick it, then it shows complete and stays complete after reload.
- AC6.2 Given a complete todo, when I untick it, then it's incomplete again.

### US7 Delete a todo

As a user, I want to delete todos I no longer need so that my list stays clean.

- AC7.1 Given I have a todo, when I click delete, then it disappears immediately and an Undo toast shows for 5 seconds (no confirmation dialog).
- AC7.2 Given the toast is showing, when I click Undo, then the todo reappears and no delete request was sent.
- AC7.3 Given the toast is showing, when 5 seconds pass, then the delete is sent and the todo is permanently gone, even after reload.
- AC7.4 Given a todo belongs to another user, when I send a delete request for its ID, then I get 404 and the todo remains.
- AC7.5 Given I'm logged in, when a request to delete a todo arrives from a different origin (not our site), then it's rejected with 403 and the todo remains.
- AC7.6 Given the Undo toast is showing, when I close the tab or reload before 5 seconds pass, then no delete is sent and the todo is still there next time I open the board (a known, accepted behavior).

### US8 Manage tags

As a user, I want to create, rename, and delete my own tags so that I can organize todos my way.

- AC8.1 Given I'm logged in, when I create tag "school", then it's available to attach to my todos.
- AC8.2 Given I have tag "school", when I create "school" (any case) again, then I see a duplicate error.
- AC8.3 Given a tag is on some todos, when I delete it, then it's removed from those todos and the todos remain.
- AC8.4 Given another user has "school", when I create my own "school", then it succeeds.
- AC8.5 Given I enter a tag name over 30 characters, when I save, then I get 400 and no tag is created.

### US9 Filter

As a user, I want to filter by priority, tag, or completion so that I can focus.

- AC9.1 Given a mix of priorities, when I filter by high, then every column shows only high-priority todos.
- AC9.2 Given complete and incomplete todos, when I turn on Hide completed, then completed todos disappear from every column.
- AC9.3 Given a todo tagged "school", when I filter by that tag, then every column shows only todos with it.
- AC9.4 Given I filter by tag "school" and priority high, then only todos matching both are shown.
- AC9.5 Given a filter is active, when I go to the next week, then the filter is still active and its chips are visible; when I click "Clear filters", then all filters are removed.
- AC9.6 Given a filter that matches nothing, when I apply it, then the board shows "No todos match your filters" with a "Clear filters" button.

### US10 Order within a day

As a user, I want todos in a column ordered predictably so that what matters most is on top.

- AC10.1 Given a high and a low priority todo on the same day, then the high one appears above the low one.
- AC10.2 Given two todos with the same priority on the same day, then the one created earlier appears above.
- AC10.3 Given a completed high-priority todo and an incomplete low-priority todo on the same day, then the incomplete one appears above, and the completed one is struck through.

### US11 Navigate weeks

As a user, I want to move between weeks so that I can plan ahead and look back.

- AC11.1 Given I'm viewing this week, when I click Next week, then the board shows the following Monday to Sunday, the date range updates, and Overdue and Unscheduled are unchanged.
- AC11.2 Given I'm viewing this week, when I click Previous week, then the board shows the previous Monday to Sunday.
- AC11.3 Given I'm viewing another week, when I click This week, then the current week is shown with today highlighted.
- AC11.4 Given a todo due Sun Oct 18 and one due Mon Oct 19, when I view the week of Oct 12, then Sunday's todo appears and Monday's does not.

### US12 Move a todo to another day

As a user, I want to change a todo's day quickly so that I can reschedule as plans change.

- AC12.1 Given a todo in Tuesday, when I drag it to Friday, then it appears in Friday and is still there after reload.
- AC12.2 Given a todo in Tuesday, when I drag it to Unscheduled, then its due date is cleared and it appears in Unscheduled after reload.
- AC12.3 Given a todo, when I choose a day from its "Move to..." menu or change its date in the edit form, then it moves to that day (works with the keyboard only).
- AC12.4 Given the server rejects or can't be reached, when I move a todo, then the card returns to its original column and I see an error message.
- AC12.5 Given a card, when I drop it on Overdue, then it returns to its original column and no request is sent.

### US13 Handle overdue todos

As a user, I want unfinished past todos kept in sight so that nothing is forgotten.

- AC13.1 Given an incomplete todo due before today, when I open the board for any week, then it appears in Overdue.
- AC13.2 Given a completed todo due before today, then it is not in Overdue and appears in its original day.
- AC13.3 Given a todo due today, then it is not in Overdue.
- AC13.4 Given a todo in Overdue, when I click "Reschedule to today", then it moves to today's column and leaves Overdue, and stays after reload.
- AC13.5 Given several overdue todos, then the one with the oldest due date is on top.

### US14 Use the board on a small screen

As a user, I want the board usable on my phone so that I can check my todos anywhere.

- AC14.1 Given a viewport 900px wide or more, when I open the board, then I see all columns side by side.
- AC14.2 Given a viewport narrower than 900px, when I open the board, then I see a tab bar (Overdue, Mon..Sun, Unscheduled) and only one column; the default tab is today if it is in the viewed week, otherwise Monday.
- AC14.3 Given a narrow viewport, when I tap a tab, then that column's todos are shown.
- AC14.4 Given a narrow viewport, then drag and drop is disabled and "Move to..." works.

## 6. Testing plan

- Each AC becomes a Playwright E2E test (UI criteria) or an API integration test (401/404/400/409 and authorization criteria).
- Tests run against the Docker Compose stack using a separate test database, which is wiped once at the start of each run.
- **Test data (decided):** every test registers its own unique user (random email), so tests never share data and can run in parallel. No per-test database reset.
- **Demo seed script:** `npm run seed` creates a demo user (`demo@example.com`) with about 12 realistic todos across the current week, plus Overdue and Unscheduled items, several tags and all three priorities. It is for the Day 4 demo only; tests never depend on it.
- Date-dependent tests (US4, US11, US13) fix the browser clock (Playwright `page.clock`) so "today" is deterministic.
- Drag-and-drop tests use Playwright's drag support; each also has a non-drag equivalent (AC12.3).
- Responsive tests (US14) run with a narrow viewport (e.g. 390px wide) and a wide one.

## 6b. Definition of Done

The project is done when all of these are true:

1. `docker compose up` starts nginx, 2 API instances, PostgreSQL and Redis with no manual steps.
2. Every acceptance criterion in US1-US14 has a passing test.
3. All Playwright E2E and API integration tests pass with one command.
4. The seed script produces a populated demo board.
5. The README explains setup, how to run tests, and the architecture.
6. No secrets are committed; `.env.example` lists the variable names.
7. Retrospective notes (what Copilot did well and badly) are written.

## 6c. Docker and configuration

- Only nginx publishes a port to the host: **8080**. Postgres (5432) and Redis (6379) are reachable only inside the Compose network; the API listens on 3000 inside the network.
- Compose services: `nginx`, `api` (2 replicas), `postgres`, `redis`. A one-off step runs Prisma migrations before the APIs start.
- Configuration comes from environment variables loaded from `.env` (never committed). `.env.example` is committed with fake values: `DATABASE_URL`, `REDIS_URL`, `NODE_ENV`, `PORT`, `ALLOWED_ORIGIN` (used for the CSRF Origin check), `COOKIE_SECURE`.
- Test runs use a separate test database (e.g. `todo_test`), wiped at the start of each run.

## 7. Out of scope

Sharing/collaboration, reminders/notifications, soft delete/trash, password reset, social login, custom priority levels, manual reordering within a day, selecting several tags at once, times of day, recurring todos, automatic rolling of overdue todos, a configurable week start, a "week/month" calendar view beyond the weekly board, dark mode.

## 8. Confirmed parameters

Title max 200; tag name max 30; max 10 tags per todo; password min 8; session 7 days sliding; date-only due dates; week starts Monday and shows 7 days; ordering is incomplete first, then priority, then oldest created; overdue is shown in its own column; quick-add per column plus a full form; one tag and one priority filter plus Hide completed; single-day tabs below 900px; login rate limit 10/min per IP.

## 9. Still open

- None. All planned decisions are made; the spec is ready for review before implementation.
