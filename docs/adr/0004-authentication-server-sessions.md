# ADR 0004: Authentication: email + password with server-side sessions

**Status:** Accepted

## Context

Each user needs private data. With 100k users we run multiple API instances, so any instance must be able to identify a user.

## Problem it solves

Proves who the user is, and lets the server revoke access immediately.

## Decision

- Email + password accounts; passwords hashed with **argon2** (never stored in plain text).
- After login, the server creates a **session** stored in Redis (see ADR 0005) and sends the session ID in a cookie: `HttpOnly`, `Secure` (in production), `SameSite=Lax`.

## Pros

- Instant revocation: deleting the session logs the user out immediately (e.g. compromised account).
- HttpOnly cookie is not readable by JavaScript, reducing XSS token theft.
- Simple mental model.

## Cons / tradeoffs

- Every request needs a session lookup, so a fast shared store is required.
- Cookie-based auth needs CSRF protection (SameSite cookies plus a CSRF token or origin check for state-changing requests).
- Extra moving part (Redis) versus stateless tokens.

## Alternatives considered

| Alternative                           | Why rejected                                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT (short-lived, in HttpOnly cookie) | Stateless and easy to scale, but hard to revoke before expiry; revocation needs a blocklist (which brings back a lookup) or refresh-token complexity. |
| Third-party auth (Auth0, Clerk)       | Cost grows with user count at 100k users, vendor lock-in, and less learning value.                                                                    |

## Consequences

API instances stay stateless (state lives in Redis). Login endpoints need rate limiting. Sessions last 7 days with sliding expiry (renewed on use).
