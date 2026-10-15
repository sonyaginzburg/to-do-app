# ADR 0011: Security controls: login rate limiting, CSRF protection, and ownership checks

**Status:** Accepted

## Context

The app has 100k users and uses cookie-based sessions (ADR 0004), which exposes it to brute-force login attacks, cross-site request forgery, and attempts to access other users' data by guessing IDs (IDOR).

## Decision

1. **Login/register rate limiting:** 10 attempts per minute per IP, counted in Redis. Excess requests return **429** without checking the password.
2. **CSRF protection:** session cookie uses `SameSite=Lax`, and state-changing requests (POST/PATCH/DELETE) whose `Origin` is not our site are rejected with **403**.
3. **Ownership checks:** every todo/tag query includes `user_id = <current user>`. Another user's resource returns **404** (not 403) so existence is not revealed.
4. **Generic login errors:** "invalid email or password", never indicating which was wrong.
5. **Password hashing:** argon2; minimum length 8, no composition rules.

## Pros

- Brute-forcing 10,000 guesses goes from minutes to many hours.
- Blocks cross-site actions performed with a victim's cookie.
- Prevents data leaks between users even if IDs are discovered.
- Reuses Redis, already in the stack.

## Cons / tradeoffs

- Per-IP limiting can block many legitimate users behind one shared IP (campus, office).
- Extra middleware and tests to maintain.
- Origin checks need correct configuration across environments.

## Alternatives considered

| Alternative                           | Why rejected                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| No rate limiting                      | Leaves login open to brute force and credential stuffing.                                                             |
| Per-email rate limiting               | Lets an attacker deliberately lock victims out; per-IP is simpler. (Combining both is a possible future improvement.) |
| Synchronizer CSRF tokens only         | More frontend and server state; `SameSite` plus Origin check is sufficient for this app.                              |
| Return 403 for other users' resources | Confirms the resource exists; 404 leaks nothing.                                                                      |

## Consequences

Acceptance criteria cover 429 (AC2.5), 404 for other users' resources (AC5.2, AC7.4), and cross-origin rejection (AC7.5).
