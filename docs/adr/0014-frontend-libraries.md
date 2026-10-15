# ADR 0014: Frontend libraries: TanStack Query, CSS Modules, React Router

**Status:** Accepted

Supports ADR 0003 (React + Vite) and ADR 0013 (weekly board).

## A. Server data: TanStack Query

- **Problem:** The board loads three scopes (week, Overdue, Unscheduled), caches weeks, updates cards optimistically, and must roll back if the server rejects a move (AC12.4).
- **Decision:** Use **TanStack Query** for fetching, caching, invalidation, and optimistic mutations. Query keys include the week and the active filters, so filters persist across weeks naturally.
- **Pros:** Optimistic update and rollback are built-in patterns (`onMutate`/`onError`/`onSettled`); automatic caching makes flipping between weeks instant; far less hand-written loading/error code; avoids race conditions when navigating weeks quickly.
- **Cons:** One more dependency; query keys and invalidation are new concepts.
- **Rejected:** _Plain `fetch` + `useState`/`useEffect`_ (repeated boilerplate; fragile optimistic updates and race conditions). _Redux Toolkit / RTK Query_ (heavy for an app whose state is almost entirely server data; more boilerplate for no benefit).

## B. Styling: plain CSS with CSS variables (CSS Modules)

- **Problem:** The paper-planner look (spec section 1c) needs custom colors, fonts, shadows, and a responsive switch at 900px.
- **Decision:** One CSS Module per component, with colors, spacing, and fonts defined once as CSS variables.
- **Pros:** Full control of a custom, distinctive look; no extra tooling or build concepts; component-scoped class names avoid collisions; variables make later theme changes easy; simplest to explain.
- **Cons:** More CSS to write by hand, including media queries and states; requires discipline to keep consistent spacing.
- **Rejected:** _Tailwind CSS_ (fast and well supported by Copilot, but adds a build and config layer and long class lists; not needed for a single custom theme). _Component libraries (MUI/Chakra)_ (generic look fights the custom paper style; heavier bundle).

## C. Routing: React Router

- **Problem:** Three routes (`/register`, `/login`, `/`) with redirects based on login state.
- **Decision:** **React Router** with a route guard that redirects logged-out users to `/login` and logged-in users away from `/login` and `/register`.
- **Pros:** Standard, widely documented, handles redirects and future growth.
- **Cons:** A dependency for only three routes.
- **Rejected:** _Hand-rolled routing with `window.location`_ (reinvents history handling and is error-prone). _Next.js routing_ (rejected with Next.js in ADR 0003).

## Consequences

Server state lives in TanStack Query's cache (not in a global store). All colors and fonts live in a single `:root` CSS variables file. Drag and drop uses dnd-kit (ADR 0013).
