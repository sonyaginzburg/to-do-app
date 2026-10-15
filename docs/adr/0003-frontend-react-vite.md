# ADR 0003: Frontend: React + Vite (TypeScript)

**Status:** Accepted

## Context

The UI is interactive (filters, sorting, instant complete/undo) and sits behind a login, so SEO is irrelevant. We want a clearly separate presentation layer that talks to the API.

## Problem it solves

Renders the interface in the browser and calls the REST API.

## Decision

Use **React** built with **Vite**, in TypeScript, as a single-page app (static files).

## Pros

- Largest ecosystem and community; strong Copilot support.
- Static output can be served from a CDN, so user traffic barely loads our servers; only API calls do.
- Clean separation of layers (browser -> API -> database).
- Easy to test with Playwright.

## Cons / tradeoffs

- Routing and data fetching are chosen/assembled by us.
- Slower first paint than server-rendered pages (acceptable behind a login).

## Alternatives considered

| Alternative               | Why rejected                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Vue                       | Good and simpler, but smaller ecosystem and less Copilot training data.              |
| Next.js (server-rendered) | SEO/first-load benefits don't apply; blurs frontend/backend layers; more complexity. |
| Plain HTML/JS             | Becomes unmanageable with filters, tags, and sorting.                                |

## Consequences

Frontend is built to static files and served by nginx/CDN. All data flows through the REST API.
