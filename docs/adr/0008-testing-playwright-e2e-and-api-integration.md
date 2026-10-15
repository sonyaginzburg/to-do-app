# ADR 0008: Testing: Playwright E2E + API integration tests

**Status:** Accepted

## Context

Acceptance criteria are written in Given/When/Then (BDD style). Security rules (e.g. users cannot access others' todos) and multi-component behavior (browser -> API -> DB/Redis) must be proven.

## Problem it solves

Verifies the system behaves as specified, from the user's point of view and at the API level.

## Decision

- **Playwright end-to-end tests**: one test per user-facing acceptance criterion, run against the Docker Compose stack in a real browser.
- **API integration tests**: cover auth, validation, authorization (404 on other users' resources), pagination, and filtering/sorting logic.
- Minimal unit tests only where logic is non-trivial.

## Pros

- Proves the real system works, not just isolated parts.
- Acceptance criteria translate directly into tests (BDD).
- API tests are faster and pinpoint failures that E2E tests cannot.

## Cons / tradeoffs

- E2E tests are slower and can be flaky if not written carefully.
- Two test suites to maintain.

## Alternatives considered

| Alternative                        | Why rejected                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| E2E only                           | Simpler, but slow and failures are hard to localize; security cases are better tested at the API. |
| Full pyramid with Cucumber/Gherkin | Extra tooling and learning overhead for a one-week project.                                       |

## Consequences

Tests need seeded/isolated data per test and run against a clean database.
