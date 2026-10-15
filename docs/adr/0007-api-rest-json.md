# ADR 0007: API style: REST + JSON

**Status:** Accepted

## Context

The React frontend needs a clear contract with the backend. The domain is simple: users, todos, tags. Every endpoint must be easy to spec, test, and rate limit.

## Problem it solves

Defines how the frontend and backend communicate.

## Decision

Use a **RESTful JSON API** over HTTP, with resource URLs, standard verbs, standard status codes, and offset pagination (`limit`, `offset`).

## Pros

- Most widely understood style; simple to build and test.
- Predictable URLs enable per-endpoint rate limiting and standard HTTP caching.
- Each endpoint maps directly to a user story and Given/When/Then criteria.
- Documentable with OpenAPI.

## Cons / tradeoffs

- Can over- or under-fetch for complex screens.
- Related data may need multiple calls (mitigated by including tags on todos).

## Alternatives considered

| Alternative | Why rejected                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| GraphQL     | Main benefit (flexible nested queries) doesn't apply; harder to cache and to protect against expensive queries; more setup. |
| tRPC        | Couples frontend and backend; no standard HTTP contract, which weakens the spec and layer separation.                       |

## Consequences

Spec lists endpoints with method, URL, request, response, and status codes. Lists are always paginated.
